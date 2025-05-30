using Database.Context;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Threading.Tasks;

namespace FruityGitServer.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AuthController(AppDbContext context)
        {
            _context = context;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            if (request == null)
            {
                return BadRequest("Invalid request");
            }

            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Email == request.Email && u.Password == request.Password);

            if (user == null)
            {
                return Unauthorized("Invalid email or password");
            }

            return Ok(new
            {
                Message = "Login successful",
                User = new
                {
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
}