@extends('layouts.app')

@section('title', $user->name . "'s Profile")

@section('content')
<div class="container py-5">
    <div class="row">
        <!-- Profile Information -->
        <div class="col-md-4">
            <div class="card bg-dark text-white border-secondary mb-4">
                <div class="card-body text-center">
                    <!-- Profile Picture -->
                    <img src="{{ $user->avatar_url ?? asset('images/DefaultPfp.png') }}" 
                         class="rounded-circle mb-3" 
                         width="150" 
                         height="150" 
                         alt="{{ $user->name }}'s Profile Picture">
                    
                    <!-- User Name -->
                    <h2 class="card-title">{{ $user->name }}</h2>
                    
                    <!-- Additional info -->
                    <div class="mt-4">
                        <p class="text-muted mb-1">Member since {{ $user->created_at->format('M Y') }}</p>
                        @if($isOwnProfile)
                            <p class="text-muted mb-3">{{ $user->email }}</p>
                            <a href="{{ route('account.settings') }}" class="btn btn-outline-info w-100">
                                <i class="fas fa-cog me-2"></i>Account Settings
                            </a>
                        @endif
                    </div>
                </div>
            </div>
        </div>

        <!-- Repositories -->
        <div class="col-md-8">
            <div class="card bg-dark text-white border-secondary">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h3 class="mb-0">
                        @if($isOwnProfile)
                            My Repositories
                        @else
                            {{ $user->name }}'s Repositories
                        @endif
                    </h3>
                    @if($isOwnProfile)
                        <a href="{{ route('repositories.create') }}" class="btn btn-primary btn-sm">
                            <i class="fas fa-plus"></i> New Repository
                        </a>
                    @endif
                </div>
                <div class="card-body">
                    @if($repositories->count() > 0)
                        <div class="list-group bg-dark">
                            @foreach($repositories as $repository)
                                <div class="list-group-item bg-dark text-white border-secondary mb-2">
                                    <div class="d-flex justify-content-between align-items-center">
                                        <div>
                                            <h5 class="mb-1">
                                                <i class="fas fa-code-branch text-secondary me-2"></i>
                                                {{ $repository->name }}
                                            </h5>
                                            <p class="mb-1 text-muted">{{ $repository->description }}</p>
                                            <small class="text-muted">
                                                Created {{ $repository->created_at->diffForHumans() }}
                                            </small>
                                        </div>
                                        <div class="btn-group">
                                            <a href="{{ route('repositories.show', $repository) }}" 
                                               class="btn btn-outline-info btn-sm me-2">
                                                View
                                            </a>
                                            <button class="btn btn-outline-success btn-sm">
                                                <i class="fas fa-desktop me-1"></i> Open in App
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            @endforeach
                        </div>
                    @else
                        <div class="text-center py-4">
                            <i class="fas fa-folder-open fa-3x text-muted mb-3"></i>
                            <p class="text-muted">
                                @if($isOwnProfile)
                                    No repositories yet
                                @else
                                    {{ $user->name }} hasn't created any repositories yet
                                @endif
                            </p>
                            @if($isOwnProfile)
                                <a href="{{ route('repositories.create') }}" class="btn btn-primary">
                                    Create your first repository
                                </a>
                            @endif
                        </div>
                    @endif
                </div>
            </div>
        </div>
    </div>
</div>
@endsection