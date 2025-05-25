@extends('layouts.app')

@section('title', 'Search Results')

@section('content')
<div class="container py-5">
    <div class="row">
        <div class="col-md-8 mx-auto">
            <!-- Search Form -->
            <form action="{{ route('users.search') }}" method="GET" class="mb-5">
                <div class="input-group input-group-lg">
                    <input type="text" 
                           name="query" 
                           class="form-control bg-dark text-light border-secondary" 
                           placeholder="Search users..." 
                           value="{{ request('query') }}"
                           required>
                    <button class="btn btn-primary" type="submit">
                        <i class="fas fa-search"></i>
                    </button>
                </div>
            </form>

            <!-- Results Section -->
            @if(request()->has('query'))
                <h2 class="mb-4">
                    Search Results 
                    @if($users->count() > 0)
                        <small class="text-muted">({{ $users->count() }} found)</small>
                    @endif
                </h2>

                @if($users->isEmpty())
                    <div class="text-center py-5">
                        <i class="fas fa-search fa-3x text-muted mb-3"></i>
                        <h3 class="text-muted">No users found</h3>
                        <p class="text-muted">Try different keywords or check your spelling</p>
                    </div>
                @else
                    <div class="list-group bg-dark">
                        @foreach($users as $user)
                            <a href="{{ route('profile.show', $user) }}" 
                               class="list-group-item bg-dark text-light border-secondary">
                                <div class="d-flex align-items-center">
                                    <img src="{{ $user->avatar_url ?? asset('images/DefaultPfp.png') }}" 
                                         class="rounded-circle me-3" 
                                         width="50" 
                                         height="50" 
                                         alt="{{ $user->name }}'s avatar">
                                    <div>
                                        <h4 class="mb-1">{{ $user->name }}</h4>
                                        <p class="mb-0 text-muted">{{ $user->email }}</p>
                                        <small class="text-muted">
                                            Member since {{ $user->created_at->format('M Y') }}
                                        </small>
                                    </div>
                                </div>
                            </a>
                        @endforeach
                    </div>

                    <!-- Pagination -->
                    <div class="mt-4">
                        {{ $users->links() }}
                    </div>
                @endif
            @else
                <div class="text-center py-5">
                    <i class="fas fa-search fa-3x text-muted mb-3"></i>
                    <h3 class="text-muted">Search for Users</h3>
                    <p class="text-muted">Enter a name or email to find users</p>
                </div>
            @endif
        </div>
    </div>
</div>
@endsection 