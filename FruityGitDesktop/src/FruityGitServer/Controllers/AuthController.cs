using FruityGitServer.Context;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Threading.Tasks;

namespace FruityGitServer.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly DataContext _context;

        public AuthController(DataContext context)
        {
            _context = context;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            if (request == null || string.IsNullOrEmpty(request.Email)
                               || string.IsNullOrEmpty(request.Password))
            {
                return BadRequest("Email and password are required");
            }

            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Email == request.Email);

            if (user == null)
            {
                return Unauthorized("Invalid email or password");
            }

            // In a real application, you should hash and compare passwords properly
            if (user.Password != request.Password)
            {
                return Unauthorized("Invalid email or password");
            }

            return Ok(new LoginResponse
            {
                Success = true,
                User = new UserInfo
                {
                    Id = user.Id,
                    Name = user.Name,
                    Email = user.Email
                }
            });
        }


        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            if (request == null || string.IsNullOrEmpty(request.Email) 
                            || string.IsNullOrEmpty(request.Password)
                            || string.IsNullOrEmpty(request.Name))
            {
                return BadRequest("Name, email and password are required");
            }

            // Validate email format
            if (!new System.ComponentModel.DataAnnotations.EmailAddressAttribute().IsValid(request.Email))
            {
                return BadRequest("Invalid email format");
            }

            // Check if email already exists
            if (await _context.Users.AnyAsync(u => u.Email == request.Email))
            {
                return Conflict("Email already registered");
            }

            // In a real application, you should hash the password before storing
            var user = new User
            {
                Name = request.Name,
                Email = request.Email,
                Password = request.Password // Remember to hash this in production!
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return Ok(new RegisterResponse
            {
                Success = true,
                User = new UserInfo
                {
                    Id = user.Id,
                    Name = user.Name,
                    Email = user.Email
                }
            });
        }
    }

    public class LoginRequest
    {
        public string Email { get; set; }
        public string Password { get; set; }
    }

    public class LoginResponse
    {
        public bool Success { get; set; }
        public UserInfo User { get; set; }
    }

    public class UserInfo
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Email { get; set; }
    }

    public class RegisterRequest
    {
        public string Name { get; set; }
        public string Email { get; set; }
        public string Password { get; set; }
    }

    public class RegisterResponse
    {
        public bool Success { get; set; }
        public UserInfo User { get; set; }
    }
}