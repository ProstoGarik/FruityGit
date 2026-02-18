namespace FruityGitServer.Exceptions;

public class RepositoryNotFoundException : Exception
{
    public RepositoryNotFoundException(string repositoryName)
        : base($"Repository '{repositoryName}' not found")
    {
        RepositoryName = repositoryName;
    }

    public string RepositoryName { get; }
}

