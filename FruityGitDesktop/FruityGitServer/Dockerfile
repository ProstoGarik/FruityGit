FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS build

ENV DOTNET_NUGET_SIGNATURE_VERIFICATION=false \
    DOTNET_USE_POLLING_FILE_WATCHER=false \
    NUGET_XMLDOC_MODE=skip \
    NUGET_CERT_REVOCATION_MODE=offline \
    DOTNET_CLI_TELEMETRY_OPTOUT=1

WORKDIR /src

COPY ["FruityGitServer/FruityGitServer.csproj", "FruityGitServer/"]

RUN dotnet restore "FruityGitServer/FruityGitServer.csproj"

COPY . .
WORKDIR "/src/FruityGitServer"
RUN dotnet build "FruityGitServer.csproj" -c Release -o /app/build --no-restore

FROM build AS publish
RUN dotnet publish "FruityGitServer.csproj" -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "FruityGitServer.dll"]