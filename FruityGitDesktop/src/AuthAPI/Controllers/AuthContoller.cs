using AuthAPI.Data;
using EntitiesLibrary;
using EntitiesLibrary.Security;
using EntityLibrary.Entities.Security;
using JwtAuthenticationManager;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using NuGet.Common;

namespace AuthAPI.Controllers
{
    [Route("api/auth")]
    [ApiController]
    public class AuthContoller : ControllerBase
    {
        private readonly RoleManager<IdentityRole> _roleManager;
        private readonly UserManager<User> _userManager;
        private readonly SignInManager<User> _signInManager;
        private readonly JwtTokenHandler _jwtTokenHandler;


        public AuthContoller(RoleManager<IdentityRole> roleManager, UserManager<User> userManager, SignInManager<User> signInManager, JwtTokenHandler jwtTokenHandler)
        {
            _roleManager = roleManager;
            _userManager = userManager;
            _signInManager = signInManager;
            _jwtTokenHandler = jwtTokenHandler;
        }

        [HttpPost("login")]
        public async Task<ActionResult<SecurityResponse>> Login([FromBody] LoginRequest request)
        {
            // Находим пользователя по email
            var user = await _userManager.FindByEmailAsync(request.Email);
            
            if (user == null)
            {
                return BadRequest("Invalid login attempt.");
            }

            // Получаем имя пользователя
            var userName = user.UserName;
            
            // Выполняем вход по имени пользователя
            var result = await _signInManager.PasswordSignInAsync(userName, request.Password, false, false);

            if (result.Succeeded)
            {
                var originalRefreshToken = _jwtTokenHandler.GenerateRefreshToken();
                var hashedRefreshToken = _jwtTokenHandler.HashRefreshToken(originalRefreshToken);
                user.RefreshToken = hashedRefreshToken;
                user.RefreshTokenExpiry = DateTime.UtcNow.AddDays(7);
                var userRoles = await _userManager.GetRolesAsync(user);
                await _userManager.UpdateAsync(user);
                var token = _jwtTokenHandler.GenerateJwtToken(user, userRoles.First());

                    return Ok(
                    new SecurityResponse
                    {
                        User = user,
                        Token = token,
                        RefreshToken = originalRefreshToken
                    });
            }
            return BadRequest("Invalid login attempt.");
        }
        
        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            var userByEmail = await _userManager.FindByEmailAsync(request.Email);
            if (userByEmail != null)
                return BadRequest("Email is already taken");

            var userByName = await _userManager.FindByNameAsync(request.UserName);
            if (userByName != null)
                return BadRequest("Username is already taken");

            var user = new User
            {
                UserName = request.UserName, // Use the provided username
                Email = request.Email
            };
            
            var result = await _userManager.CreateAsync(user, request.Password);

            if (result.Succeeded)
            {
                await _signInManager.SignInAsync(user, false);
                var roleExists = await _roleManager.RoleExistsAsync(request.RoleName);
                if (!roleExists)
                {
                    await _roleManager.CreateAsync(new IdentityRole
                    {
                        Name = request.RoleName
                    });
                }
                await _userManager.AddToRoleAsync(user, request.RoleName);

                var originalRefreshToken = _jwtTokenHandler.GenerateRefreshToken();
                var hashedRefreshToken = _jwtTokenHandler.HashRefreshToken(originalRefreshToken);
                user.RefreshToken = hashedRefreshToken;
                user.RefreshTokenExpiry = DateTime.UtcNow.AddDays(7);
                var token = _jwtTokenHandler.GenerateJwtToken(user, request.RoleName);

                await _userManager.UpdateAsync(user);
                return Ok(new SecurityResponse
                {
                    User = user,
                    Token = token,
                    RefreshToken = originalRefreshToken
                });
            }
            return BadRequest(result.Errors);
        }

        [HttpGet("validate")]
        public async Task<IActionResult> ValidateAsync([FromQuery(Name = "email")] string email, [FromQuery(Name = "token")] string token)
        {
            var u = await _userManager.FindByEmailAsync(email);

            if (u == null)
            {
                return NotFound("User not found.");
            }

            var userId = _jwtTokenHandler.ValidateToken(token);

            if (userId != Convert.ToString(u.Id))
            {
                return BadRequest("Invalid token.");
            }

            return Ok(userId);
        }

        [HttpPost("refresh")]
        public async Task<IActionResult> RefreshToken([FromBody] RefreshTokenRequest request)
        {
            var hashedToken = _jwtTokenHandler.HashRefreshToken(request.Token);
            var user = _userManager.Users.FirstOrDefault(u => u.RefreshToken == hashedToken);

            if (user == null)
            {
                return Unauthorized(hashedToken);
            }
            if (user.RefreshTokenExpiry < DateTime.UtcNow)
            {
                return Unauthorized(hashedToken);
            }

            var userRoles = await _userManager.GetRolesAsync(user);
            var accessToken = _jwtTokenHandler.GenerateJwtToken(user, userRoles.First());

            var newOriginalRefreshToken = _jwtTokenHandler.GenerateRefreshToken();
            var newHashedRefreshToken = _jwtTokenHandler.HashRefreshToken(newOriginalRefreshToken);
            user.RefreshToken = newHashedRefreshToken;
            user.RefreshTokenExpiry = DateTime.UtcNow.AddDays(7);
            await _userManager.UpdateAsync(user);


            return Ok(new SecurityResponse
            {
                Token = accessToken,
                RefreshToken = newOriginalRefreshToken
            });
        }
        [HttpPost("logout")]
        public async Task<IActionResult> Logout([FromBody] LogoutRequest request)
        {
            var user = await _userManager.FindByEmailAsync(request.Email);
            if (user == null) return NotFound();

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
            {
                return BadRequest("Search query must be at least 3 characters long");
            }

            var users = _userManager.Users
                .Where(u => u.UserName.Contains(query) || u.Email.Contains(query))
                .Take(10)
                .Select(u => new UserSearchResult
                {
                    Id = u.Id,
                    UserName = u.UserName,
                    Email = u.Email
                })
                .ToList();

            return Ok(users);
        }

        public class UserSearchResult
        {
            public string Id { get; set; }
            public string UserName { get; set; }
            public string Email { get; set; }
        }
    }

}
