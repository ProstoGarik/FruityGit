namespace FruityGitServer.Exceptions;

public class UnauthorizedRepositoryAccessException : Exception
{
    public UnauthorizedRepositoryAccessException(string repositoryName)
        : base($"Access denied to repository '{repositoryName}'")
    {
        RepositoryName = repositoryName;
    }

    public string RepositoryName { get; }
}

