using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using FruityGitServer.Models;
using System.Security.Claims;

namespace FruityGitServer.Controllers
{
    [ApiController]
    [Route("api/repositories")]
    [Authorize]
    public class RepositoryController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly ILogger<RepositoryController> _logger;

        public RepositoryController(AppDbContext context, ILogger<RepositoryController> logger)
        {
            _context = context;
            _logger = logger;
        }

        [HttpGet]
        public async Task<IActionResult> GetUserRepositories()
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            _logger.LogInformation("Fetching repositories for user ID: {UserId}", userId);

            try
            {
                var repositories = await _context.Repositories
                    .Where(r => r.UserId == userId)
                    .OrderByDescending(r => r.CreatedAt)
                    .ToListAsync();

                _logger.LogInformation("Found {Count} repositories for user ID: {UserId}", 
                    repositories.Count, userId);

                return Ok(repositories);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching repositories for user ID: {UserId}", userId);
                throw;
            }
        }

        [HttpPost]
        public async Task<IActionResult> CreateRepository([FromBody] CreateRepositoryRequest request)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            _logger.LogInformation("Creating repository '{Name}' for user ID: {UserId}", 
                request.Name, userId);

            if (!ModelState.IsValid)
            {
                _logger.LogWarning("Invalid repository creation request for user ID {UserId}: {Errors}",
                    userId,
                    string.Join(", ", ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage)));
                return BadRequest(ModelState);
            }

            try
            {
                var repository = new GitRepository
                {
                    Name = request.Name,
                    Description = request.Description,
                    IsPrivate = request.IsPrivate,
                    UserId = userId
                };

                _context.Repositories.Add(repository);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Repository '{Name}' created successfully for user ID: {UserId}",
                    repository.Name, userId);

                return CreatedAtAction(nameof(GetUserRepositories), new { id = repository.Id }, repository);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating repository '{Name}' for user ID: {UserId}",
                    request.Name, userId);
                throw;
            }
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetRepository(int id)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            _logger.LogInformation("Fetching repository ID: {Id} for user ID: {UserId}", id, userId);

            try
            {
                var repository = await _context.Repositories
                    .FirstOrDefaultAsync(r => r.Id == id && r.UserId == userId);

                if (repository == null)
                {
                    _logger.LogWarning("Repository ID: {Id} not found for user ID: {UserId}", id, userId);
                    return NotFound();
                }

                _logger.LogInformation("Successfully retrieved repository ID: {Id} for user ID: {UserId}",
                    id, userId);

                return Ok(repository);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching repository ID: {Id} for user ID: {UserId}",
                    id, userId);
                throw;
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateRepository(int id, [FromBody] UpdateRepositoryRequest request)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            _logger.LogInformation("Updating repository ID: {Id} for user ID: {UserId}", id, userId);

            if (!ModelState.IsValid)
            {
                _logger.LogWarning("Invalid repository update request for ID {Id}: {Errors}",
                    id,
                    string.Join(", ", ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage)));
                return BadRequest(ModelState);
            }

            try
            {
                var repository = await _context.Repositories
                    .FirstOrDefaultAsync(r => r.Id == id && r.UserId == userId);

                if (repository == null)
                {
                    _logger.LogWarning("Repository ID: {Id} not found for user ID: {UserId} during update",
                        id, userId);
                    return NotFound();
                }

                repository.Name = request.Name ?? repository.Name;
                repository.Description = request.Description ?? repository.Description;
                repository.IsPrivate = request.IsPrivate ?? repository.IsPrivate;
                repository.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                _logger.LogInformation("Successfully updated repository ID: {Id} for user ID: {UserId}",
                    id, userId);

                return Ok(repository);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating repository ID: {Id} for user ID: {UserId}",
                    id, userId);
                throw;
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteRepository(int id)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            _logger.LogInformation("Deleting repository ID: {Id} for user ID: {UserId}", id, userId);

            try
            {
                var repository = await _context.Repositories
                    .FirstOrDefaultAsync(r => r.Id == id && r.UserId == userId);

                if (repository == null)
                {
                    _logger.LogWarning("Repository ID: {Id} not found for user ID: {UserId} during deletion",
                        id, userId);
                    return NotFound();
                }

                _context.Repositories.Remove(repository);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Successfully deleted repository ID: {Id} for user ID: {UserId}",
                    id, userId);

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting repository ID: {Id} for user ID: {UserId}",
                    id, userId);
                throw;
            }
        }
    }

    public class CreateRepositoryRequest
    {
        public string Name { get; set; }
        public string? Description { get; set; }
        public bool IsPrivate { get; set; }
    }

    public class UpdateRepositoryRequest
    {
        public string? Name { get; set; }
        public string? Description { get; set; }
        public bool? IsPrivate { get; set; }
    }
} 