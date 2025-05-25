@extends('layouts.app')

@section('title', 'Dashboard')

@section('content')
<div class="container py-5">
    <div class="row">
        <!-- Welcome Section -->
        <div class="col-12 mb-5">
            <div class="card bg-dark text-white border-secondary">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h1 class="mb-3">Welcome back, {{ auth()->user()->name }}!</h1>
                            <p class="text-muted mb-0">Explore the latest public repositories or create your own.</p>
                        </div>
                        <a href="{{ route('repositories.create') }}" class="btn btn-primary">
                            <i class="fas fa-plus me-2"></i>New Repository
                        </a>
                    </div>
                </div>
            </div>
        </div>

        <!-- Latest Repositories -->
        <div class="col-12">
            <div class="card bg-dark text-white border-secondary">
                <div class="card-header border-secondary">
                    <h2 class="mb-0">Latest Public Repositories</h2>
                </div>
                <div class="card-body">
                    @if($repositories->isEmpty())
                        <div class="text-center py-5">
                            <i class="fas fa-folder-open fa-3x text-muted mb-3"></i>
                            <h3 class="text-muted">No repositories yet</h3>
                            <p class="text-muted">Be the first to create a public repository!</p>
                            <a href="{{ route('repositories.create') }}" class="btn btn-primary">
                                Create Repository
                            </a>
                        </div>
                    @else
                        <div class="list-group bg-dark">
                            @foreach($repositories as $repository)
                                <div class="list-group-item bg-dark text-white border-secondary mb-3">
                                    <div class="d-flex justify-content-between align-items-start">
                                        <div class="flex-grow-1">
                                            <div class="d-flex align-items-center mb-2">
                                                <a href="{{ route('profile.show', $repository->user) }}" 
                                                   class="text-decoration-none me-3">
                                                    <img src="{{ $repository->user->avatar_url ?? asset('images/DefaultPfp.png') }}" 
                                                         class="rounded-circle" 
                                                         width="40" 
                                                         height="40" 
                                                         alt="{{ $repository->user->name }}'s avatar">
                                                </a>
                                                <div>
                                                    <h4 class="mb-0">
                                                        <i class="fas fa-code-branch text-secondary me-2"></i>
                                                        {{ $repository->name }}
                                                    </h4>
                                                    <small class="text-muted">
                                                        Created by 
                                                        <a href="{{ route('profile.show', $repository->user) }}" 
                                                           class="text-info text-decoration-none">
                                                            {{ $repository->user->name }}
                                                        </a>
                                                        {{ $repository->created_at->diffForHumans() }}
                                                    </small>
                                                </div>
                                            </div>
                                            <p class="mb-3 text-muted">{{ $repository->description }}</p>
                                            <div class="d-flex gap-2">
                                                <a href="{{ route('repositories.show', $repository) }}" 
                                                   class="btn btn-outline-info btn-sm">
                                                    <i class="fas fa-eye me-1"></i> View
                                                </a>
                                                <button class="btn btn-outline-success btn-sm">
                                                    <i class="fas fa-desktop me-1"></i> Open in App
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            @endforeach
                        </div>

                        <!-- Pagination -->
                        <div class="mt-4">
                            {{ $repositories->links() }}
                        </div>
                    @endif
                </div>
            </div>
        </div>
    </div>
</div>
@endsection 