<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>@yield('title', 'FruityGit')</title>
    @vite(['resources/sass/app.scss', 'resources/js/app.js'])
</head>
<body class="bg-dark text-light">
    <header class="navbar navbar-expand-md navbar-dark bg-dark border-bottom border-secondary">
        <div class="container-fluid">
            <a class="navbar-brand d-flex align-items-center" href="{{ url('/') }}">
                <img src="{{ asset('images/FruityLogo.png') }}" 
                    alt="FruityGit" 
                    height="35" 
                    class="d-inline-block align-top">
                <span class="ms-2 fw-semibold">FruityGit</span>
            </a>

            <div class="d-none d-md-flex mx-auto" style="width: 500px;">
                <input class="form-control bg-dark text-light border-secondary" type="search" placeholder="Search or jump to...">
            </div>

            <div class="navbar-nav flex-row">
                @auth
                    <a class="nav-link px-3" href="{{ route('profile') }}">
                        <img src="{{ Auth::user()->avatar_url ?? asset('images/DefaultPfp.png') }}" 
                            width="32" 
                            height="32" 
                            class="rounded-circle" 
                            alt="Profile">
                    </a>
                @else
                    <!-- Бананчики -->
                @endauth
            </div>
        </div>
    </header>

    <main class="container-fluid py-4">
        @yield('content')
    </main>
</body>
</html>