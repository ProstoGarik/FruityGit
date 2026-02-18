namespace FruityGitServer.Exceptions;

public class InvalidRepositoryNameException : Exception
{
    public InvalidRepositoryNameException(string repositoryName)
        : base($"Invalid repository name: '{repositoryName}'")
    {
        RepositoryName = repositoryName;
    }

    public string RepositoryName { get; }
}

