FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS build
ENV DOTNET_NUGET_SIGNATURE_VERIFICATION=false
ENV DOTNET_USE_POLLING_FILE_WATCHER=false
ENV NUGET_XMLDOC_MODE=skip
ENV NUGET_CERT_REVOCATION_MODE=offline
WORKDIR /src


COPY ["FruityGitServer/FruityGitServer.csproj", "FruityGitServer/"]

RUN dotnet restore "FruityGitServer/FruityGitServer.csproj"

COPY . .

WORKDIR "/src/FruityGitServer"
RUN dotnet build "FruityGitServer.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "FruityGitServer.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "FruityGitServer.dll"]