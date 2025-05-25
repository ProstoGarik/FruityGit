@extends('layouts.app')

@section('title', 'Account Settings')

@section('content')
<div class="container py-5">
    <div class="row justify-content-center">
        <div class="col-md-8">
            <h1 class="mb-4">Account Settings</h1>

            @if (session('success'))
                <div class="alert alert-success alert-dismissible fade show" role="alert">
                    {{ session('success') }}
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                </div>
            @endif

            <!-- Change Name -->
            <div class="card bg-dark text-light border-secondary mb-4">
                <div class="card-header bg-dark border-secondary">
                    <h3 class="mb-0">Change Name</h3>
                </div>
                <div class="card-body">
                    <form action="{{ route('account.update-name') }}" method="POST">
                        @csrf
                        @method('PATCH')
                        <div class="mb-3">
                            <label for="name" class="form-label">New Name</label>
                            <input type="text" class="form-control bg-secondary text-light border-dark @error('name') is-invalid @enderror" 
                                   id="name" name="name" value="{{ old('name', auth()->user()->name) }}" required>
                            @error('name')
                                <div class="invalid-feedback">{{ $message }}</div>
                            @enderror
                        </div>
                        <button type="submit" class="btn btn-primary">Update Name</button>
                    </form>
                </div>
            </div>

            <!-- Change Profile Picture -->
            <div class="card bg-dark text-light border-secondary mb-4">
                <div class="card-header bg-dark border-secondary">
                    <h3 class="mb-0">Change Profile Picture</h3>
                </div>
                <div class="card-body">
                    <form action="{{ route('account.update-avatar') }}" method="POST" enctype="multipart/form-data">
                        @csrf
                        @method('PATCH')
                        <div class="mb-3">
                            <label for="avatar" class="form-label">New Profile Picture</label>
                            <input type="file" class="form-control bg-secondary text-light border-dark @error('avatar') is-invalid @enderror" 
                                   id="avatar" name="avatar" accept="image/*" required>
                            @error('avatar')
                                <div class="invalid-feedback">{{ $message }}</div>
                            @enderror
                            <div class="form-text text-muted">Maximum file size: 2MB</div>
                        </div>
                        <button type="submit" class="btn btn-primary">Update Picture</button>
                    </form>
                </div>
            </div>

            <!-- Change Password -->
            <div class="card bg-dark text-light border-secondary mb-4">
                <div class="card-header bg-dark border-secondary">
                    <h3 class="mb-0">Change Password</h3>
                </div>
                <div class="card-body">
                    <form action="{{ route('account.update-password') }}" method="POST">
                        @csrf
                        @method('PATCH')
                        <div class="mb-3">
                            <label for="current_password" class="form-label">Current Password</label>
                            <input type="password" class="form-control bg-secondary text-light border-dark @error('current_password') is-invalid @enderror" 
                                   id="current_password" name="current_password" required>
                            @error('current_password')
                                <div class="invalid-feedback">{{ $message }}</div>
                            @enderror
                        </div>
                        <div class="mb-3">
                            <label for="password" class="form-label">New Password</label>
                            <input type="password" class="form-control bg-secondary text-light border-dark @error('password') is-invalid @enderror" 
                                   id="password" name="password" required>
                            @error('password')
                                <div class="invalid-feedback">{{ $message }}</div>
                            @enderror
                        </div>
                        <div class="mb-3">
                            <label for="password_confirmation" class="form-label">Confirm New Password</label>
                            <input type="password" class="form-control bg-secondary text-light border-dark" 
                                   id="password_confirmation" name="password_confirmation" required>
                        </div>
                        <button type="submit" class="btn btn-primary">Update Password</button>
                    </form>
                </div>
            </div>

            <!-- Delete Account -->
            <div class="card bg-dark text-light border-secondary border-danger">
                <div class="card-header bg-dark border-danger text-danger">
                    <h3 class="mb-0">Delete Account</h3>
                </div>
                <div class="card-body">
                    <p class="text-danger mb-4">Warning: This action cannot be undone. All your data will be permanently deleted.</p>
                    <form action="{{ route('account.delete') }}" method="POST" onsubmit="return confirm('Are you sure you want to delete your account? This action cannot be undone.');">
                        @csrf
                        @method('DELETE')
                        <div class="mb-3">
                            <label for="delete_password" class="form-label">Enter your password to confirm</label>
                            <input type="password" class="form-control bg-secondary text-light border-dark @error('password') is-invalid @enderror" 
                                   id="delete_password" name="password" required>
                            @error('password')
                                <div class="invalid-feedback">{{ $message }}</div>
                            @enderror
                        </div>
                        <button type="submit" class="btn btn-danger">Delete Account</button>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
@endsection 