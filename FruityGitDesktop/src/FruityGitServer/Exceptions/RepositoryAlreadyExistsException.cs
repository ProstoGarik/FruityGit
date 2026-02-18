namespace FruityGitServer.Exceptions;

public class RepositoryAlreadyExistsException : Exception
{
    public RepositoryAlreadyExistsException(string repositoryName)
        : base($"Repository '{repositoryName}' already exists")
    {
        RepositoryName = repositoryName;
    }

    public string RepositoryName { get; }
}

