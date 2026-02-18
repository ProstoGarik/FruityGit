using FruityGitServer.DTOs;

namespace FruityGitServer.Services;

public interface IGitService
{
    Task<RepositoryResponseDto> InitializeRepositoryAsync(string repoName, RepositoryInitRequest request);
    Task<CommitResponseDto> CommitAsync(string repoName, CommitRequestDto request);
    Task<RepositoriesListResponseDto> GetRepositoriesAsync(UserInfoDto userInfo);
    Task<CommitHistoryResponseDto> GetHistoryAsync(string repoName, UserInfoDto userInfo);
    Task DeleteRepositoryAsync(string repoName, UserInfoDto userInfo);
    Task<Stream> DownloadRepositoryAsync(string repoName, UserInfoDto userInfo);
    Task<List<FileInfoDto>> GetRepositoryFilesAsync(string repoName, UserInfoDto userInfo);
}

