using FruityGitServer.Authentication;
using FruityGitServer.Models;
using FruityGitServer.Models.Auth;
using FruityGitServer.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FruityGitServer.Controllers;

[Route("api/auth")]
[ApiController]
public class AuthController : ControllerBase
{
    private readonly RoleManager<IdentityRole> _roleManager;
    private readonly UserManager<User> _userManager;
    private readonly SignInManager<User> _signInManager;
    private readonly JwtTokenHandler _jwtTokenHandler;
    private readonly GiteaService _giteaService;

    public AuthController(
        RoleManager<IdentityRole> roleManager,
        UserManager<User> userManager,
        SignInManager<User> signInManager,
        JwtTokenHandler jwtTokenHandler,
        GiteaService giteaService)
    {
        _roleManager = roleManager;
        _userManager = userManager;
        _signInManager = signInManager;
        _jwtTokenHandler = jwtTokenHandler;
        _giteaService = giteaService;
    }

    [HttpPost("login")]
    public async Task<ActionResult<SecurityResponse>> Login([FromBody] LoginRequest request)
    {
        var user = await _userManager.FindByEmailAsync(request.Email);
        if (user == null)
            return BadRequest("Invalid login attempt.");

        var result = await _signInManager.PasswordSignInAsync(user.UserName!, request.Password, false, false);
        if (!result.Succeeded)
            return BadRequest("Invalid login attempt.");

        var originalRefreshToken = _jwtTokenHandler.GenerateRefreshToken();
        user.RefreshToken = _jwtTokenHandler.HashRefreshToken(originalRefreshToken);
        user.RefreshTokenExpiry = DateTime.UtcNow.AddDays(7);
        var userRoles = await _userManager.GetRolesAsync(user);
        await _userManager.UpdateAsync(user);
        var token = _jwtTokenHandler.GenerateJwtToken(user, userRoles.FirstOrDefault() ?? "User");

        await _giteaService.CreateUserAsync(user.UserName!, user.Email!, request.Password);
        var giteaToken = await _giteaService.CreateUserTokenAsync(user.UserName!, request.Password);

        return Ok(new SecurityResponse
        {
            User = user,
            Token = token,
            RefreshToken = originalRefreshToken,
            GiteaToken = giteaToken // новое поле
        });
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        if (await _userManager.FindByEmailAsync(request.Email) != null)
            return BadRequest("Email is already taken");
        if (await _userManager.FindByNameAsync(request.UserName) != null)
            return BadRequest("Username is already taken");

        var user = new User
        {
            UserName = request.UserName,
            Email = request.Email
        };
        var result = await _userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
            return BadRequest(result.Errors);

        await _signInManager.SignInAsync(user, false);
        var roleName = string.IsNullOrWhiteSpace(request.RoleName) ? "User" : request.RoleName;
        if (!await _roleManager.RoleExistsAsync(roleName))
            await _roleManager.CreateAsync(new IdentityRole(roleName));
        await _userManager.AddToRoleAsync(user, roleName);

        var originalRefreshToken = _jwtTokenHandler.GenerateRefreshToken();
        user.RefreshToken = _jwtTokenHandler.HashRefreshToken(originalRefreshToken);
        user.RefreshTokenExpiry = DateTime.UtcNow.AddDays(7);
        var token = _jwtTokenHandler.GenerateJwtToken(user, roleName);
        await _userManager.UpdateAsync(user);

        await _giteaService.CreateUserAsync(user.UserName!, user.Email!, request.Password);
        var giteaToken = await _giteaService.CreateUserTokenAsync(user.UserName!, request.Password);

        return Ok(new SecurityResponse
        {
            User = user,
            Token = token,
            RefreshToken = originalRefreshToken,
            GiteaToken = giteaToken // новое поле
        });
    }

    [HttpGet("validate")]
    public async Task<IActionResult> Validate([FromQuery(Name = "email")] string email, [FromQuery(Name = "token")] string token)
    {
        var user = await _userManager.FindByEmailAsync(email);
        if (user == null)
            return NotFound("User not found.");

        var userId = _jwtTokenHandler.ValidateToken(token);
        if (userId == null || userId != user.Id)
            return BadRequest("Invalid token.");

        return Ok(userId);
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> RefreshToken([FromBody] RefreshTokenRequest request)
    {
        var hashedToken = _jwtTokenHandler.HashRefreshToken(request.Token);
        var user = _userManager.Users.FirstOrDefault(u => u.RefreshToken == hashedToken);
        if (user == null || user.RefreshTokenExpiry < DateTime.UtcNow)
            return Unauthorized();

        var userRoles = await _userManager.GetRolesAsync(user);
        var accessToken = _jwtTokenHandler.GenerateJwtToken(user, userRoles.FirstOrDefault() ?? "User");

        var newRefreshToken = _jwtTokenHandler.GenerateRefreshToken();
        user.RefreshToken = _jwtTokenHandler.HashRefreshToken(newRefreshToken);
        user.RefreshTokenExpiry = DateTime.UtcNow.AddDays(7);
        await _userManager.UpdateAsync(user);

        return Ok(new SecurityResponse
        {
            Token = accessToken,
            RefreshToken = newRefreshToken
        });
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromBody] LogoutRequest request)
    {
        var user = await _userManager.FindByEmailAsync(request.Email);
        if (user == null)
            return NotFound();

        user.RefreshToken = null;
        user.RefreshTokenExpiry = DateTime.MinValue;
        await _userManager.UpdateAsync(user);
        await _signInManager.SignOutAsync();
        return Ok();
    }

    [HttpGet("search")]
    public async Task<ActionResult<IEnumerable<UserSearchResult>>> SearchUsers([FromQuery] string query)
    {
        if (string.IsNullOrWhiteSpace(query) || query.Length < 3)
            return BadRequest("Search query must be at least 3 characters long");

        var users = await _userManager.Users
            .Where(u => (u.UserName != null && u.UserName.Contains(query)) || (u.Email != null && u.Email.Contains(query)))
            .Take(10)
            .Select(u => new UserSearchResult
            {
                UserName = u.UserName ?? "",
                Email = u.Email ?? ""
            })
            .ToListAsync();

        return Ok(users);
    }
}

public class UserSearchResult
{
    public string UserName { get; set; } = "";
    public string Email { get; set; } = "";
}