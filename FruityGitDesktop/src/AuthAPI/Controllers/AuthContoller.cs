﻿using AuthAPI.Data;
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
            var result = await _signInManager.PasswordSignInAsync(request.Email, request.Password, false, false);

            if (result.Succeeded)
            {
                var user = _userManager.Users.SingleOrDefault(r => r.Email == request.Email);
                if (user != null)
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
            }
            return BadRequest(request);
        }
        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            var user = await _userManager.FindByEmailAsync(request.Email);
            if (user != null)
                return Ok(user);

            user = new User
            {
                UserName = request.Email,
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
                return Ok(

                        new SecurityResponse
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
    }

}
