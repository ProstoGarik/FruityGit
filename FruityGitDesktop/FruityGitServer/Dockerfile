FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
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