FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS build

# Environment variables
ENV DOTNET_NUGET_SIGNATURE_VERIFICATION=false \
    DOTNET_USE_POLLING_FILE_WATCHER=false \
    NUGET_XMLDOC_MODE=skip \
    NUGET_CERT_REVOCATION_MODE=offline \
    DOTNET_CLI_TELEMETRY_OPTOUT=1

WORKDIR /src

# Copy csproj and restore as distinct layers
COPY ["src/FruityGitServer/FruityGitServer.csproj", "src/FruityGitServer/"]
RUN dotnet restore "./src/FruityGitServer/FruityGitServer.csproj"

# Copy everything else and build
COPY . .
WORKDIR "/src/FruityGitServer"
RUN dotnet build "FruityGitServer.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "FruityGitServer.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS runtime
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "FruityGitServer.dll"]