FROM mcr.microsoft.com/dotnet/sdk:7.0 AS build

WORKDIR /src

COPY ["FruityGitServer.csproj", "./"]
RUN dotnet restore "FruityGitServer.csproj"


COPY . .
RUN dotnet build "FruityGitServer.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "FruityGitServer.csproj" -c Release -o /app/publish


FROM mcr.microsoft.com/dotnet/aspnet:7.0
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "FruityGitServer.dll"]