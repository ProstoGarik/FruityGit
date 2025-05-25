<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>@yield('title', 'FruityGit')</title>
    
    <!-- Bootstrap CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <!-- Font Awesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    @vite(['resources/sass/app.scss', 'resources/js/app.js'])

    <style>
        .dropdown-item:hover {
            background-color: rgba(255, 255, 255, 0.1) !important;
        }
        .profile-dropdown {
            position: relative;
        }
        .profile-dropdown .dropdown-menu {
            position: absolute;
            right: 0;
            top: 100%;
            margin-top: 0.5rem;
            min-width: 200px;
            z-index: 1000;
        }
        .profile-dropdown .dropdown-toggle::after {
            display: none;
        }
    </style>
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

            @auth
                <div class="d-none d-md-flex mx-auto" style="width: 500px;">
                    <form action="{{ route('users.search') }}" method="GET" class="w-100">
                        <div class="input-group">
                            <input type="text" 
                                   name="query" 
                                   class="form-control bg-dark text-light border-secondary" 
                                   placeholder="Search users..."
                                   value="{{ request('query') }}">
                            <button class="btn btn-outline-secondary" type="submit">
                                <i class="fas fa-search"></i>
                            </button>
                        </div>
                    </form>
                </div>
            @endauth

            <div class="navbar-nav flex-row">
                @auth
                    <div class="profile-dropdown">
                        <div class="dropdown">
                            <img src="{{ Auth::user()->avatar_url ?? asset('images/DefaultPfp.png') }}" 
                                width="32" 
                                height="32" 
                                class="rounded-circle cursor-pointer"
                                role="button"
                                onclick="toggleDropdown(this)"
                                alt="Profile">
                            <ul class="dropdown-menu dropdown-menu-end bg-dark border-secondary">
                                <li>
                                    <a class="dropdown-item text-light d-flex align-items-center py-2" href="{{ route('profile') }}">
                                        <i class="fas fa-user me-2"></i> Profile
                                    </a>
                                </li>
                                <li><hr class="dropdown-divider border-secondary my-2"></li>
                                <li>
                                    <form action="{{ route('logout') }}" method="POST" class="d-inline">
                                        @csrf
                                        <button type="submit" class="dropdown-item text-light d-flex align-items-center py-2 w-100">
                                            <i class="fas fa-sign-out-alt me-2"></i> Log out
                                        </button>
                                    </form>
                                </li>
                            </ul>
                        </div>
                    </div>
                @else
                    <div class="d-flex">
                        <a href="{{ route('login') }}" class="btn btn-outline-light me-2">Log in</a>
                        <a href="{{ route('register') }}" class="btn btn-primary">Sign up</a>
                    </div>
                @endauth
            </div>
        </div>
    </header>

    <main class="container-fluid py-4">
        @yield('content')
    </main>

    <!-- Bootstrap JavaScript Bundle with Popper -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/js/bootstrap.bundle.min.js"></script>
    
    <script>
        // Custom dropdown toggle function
        function toggleDropdown(element) {
            const dropdownMenu = element.closest('.dropdown').querySelector('.dropdown-menu');
            const isOpen = dropdownMenu.classList.contains('show');
            
            // Close all dropdowns
            document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
                menu.classList.remove('show');
            });
            
            // Toggle current dropdown
            if (!isOpen) {
                dropdownMenu.classList.add('show');
                
                // Ensure the dropdown is fully visible
                const rect = dropdownMenu.getBoundingClientRect();
                const viewportHeight = window.innerHeight;
                
                if (rect.bottom > viewportHeight) {
                    dropdownMenu.style.top = 'auto';
                    dropdownMenu.style.bottom = '100%';
                    dropdownMenu.style.marginTop = '0';
                    dropdownMenu.style.marginBottom = '0.5rem';
                }
            }
            
            // Close dropdown when clicking outside
            document.addEventListener('click', function closeDropdown(e) {
                if (!element.contains(e.target) && !dropdownMenu.contains(e.target)) {
                    dropdownMenu.classList.remove('show');
                    document.removeEventListener('click', closeDropdown);
                }
            });
        }
        
        // Add cursor pointer style
        document.addEventListener('DOMContentLoaded', function() {
            const profileImage = document.querySelector('.profile-dropdown img');
            if (profileImage) {
                profileImage.style.cursor = 'pointer';
            }
        });
    </script>
</body>
</html>