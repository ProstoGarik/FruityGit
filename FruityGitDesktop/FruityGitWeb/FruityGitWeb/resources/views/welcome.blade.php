@extends('layouts.app')

@section('content')
<div class="container py-5">
    <div class="row justify-content-center">
        <div class="col-md-8 text-center">
            <img src="{{ asset('images/FruityLogo.png') }}" 
                alt="FruityGit" 
                height="120" 
                class="mb-4">
            <h1 class="display-4 mb-4">Welcome to FruityGit</h1>
            <p class="lead mb-5">A beautiful Git client for managing your repositories with ease.</p>
            
            <div class="d-grid gap-3 d-sm-flex justify-content-sm-center">
                <a href="{{ route('login') }}" class="btn btn-outline-light btn-lg px-4">Log in</a>
                <a href="{{ route('register') }}" class="btn btn-primary btn-lg px-4">Sign up</a>
            </div>
            
            <div class="row mt-5">
                <div class="col-md-4">
                    <div class="card bg-dark text-light border-secondary h-100">
                        <div class="card-body">
                            <i class="fas fa-code-branch fa-2x mb-3 text-primary"></i>
                            <h3>Git Management</h3>
                            <p>Easily manage your Git repositories with a beautiful interface.</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card bg-dark text-light border-secondary h-100">
                        <div class="card-body">
                            <i class="fas fa-sync fa-2x mb-3 text-primary"></i>
                            <h3>Real-time Sync</h3>
                            <p>Keep your repositories in sync across all your devices.</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card bg-dark text-light border-secondary h-100">
                        <div class="card-body">
                            <i class="fas fa-desktop fa-2x mb-3 text-primary"></i>
                            <h3>Desktop App</h3>
                            <p>Use our powerful desktop application for enhanced features.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
@endsection 