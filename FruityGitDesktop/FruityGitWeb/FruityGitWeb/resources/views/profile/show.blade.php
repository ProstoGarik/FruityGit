@extends('layouts.app')

@section('title', 'Profile')

@section('content')
<div class="container py-5">
    <div class="row justify-content-center">
        <div class="col-md-8 col-lg-6">
            <div class="card bg-dark text-white border-secondary">
                <div class="card-body text-center">
                    <!-- Profile Picture -->
                    <img src="{{ $user->avatar_url ?? asset('images/DefaultPfp.png') }}" 
                         class="rounded-circle mb-3" 
                         width="150" 
                         height="150" 
                         alt="Profile Picture">
                    
                    <!-- User Name -->
                    <h2 class="card-title">{{ $user->name }}</h2>
                    
                    <!-- Additional info can be added here -->
                    <div class="mt-4">
                        <p class="text-muted mb-1">Member since {{ $user->created_at->format('M Y') }}</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
@endsection