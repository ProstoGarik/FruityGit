<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Auth;
use App\Http\Controllers\{
    ProfileController, 
    RepositoryController, 
    WebAuthController,
    Auth\RegisterController,
    AccountSettingsController,
    UserSearchController,
    DashboardController
};

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "web" middleware group. Make something great!
|
*/

Route::get('/', function () {
    if (Auth::check()) {
        return redirect()->route('dashboard');
    }
    return view('welcome');
})->name('home');

// Authentication Routes
Route::middleware('guest')->group(function () {
    // Login Routes
    Route::get('/login', function () {
        return view('auth.login');
    })->name('login');
    Route::post('/login', [WebAuthController::class, 'login']);

    // Registration Routes
    Route::get('/register', function () {
        return view('auth.register');
    })->name('register');
    Route::post('/register', [RegisterController::class, 'register']);

    // Password Reset Routes
    Route::get('/password/reset', function () {
        return view('auth.passwords.email');
    })->name('password.request');
});

// Logout Route
Route::post('/logout', [WebAuthController::class, 'logout'])
    ->name('logout')
    ->middleware('auth');

// Protected Routes
Route::middleware(['auth'])->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');
    
    Route::get('/profile', [ProfileController::class, 'show'])->name('profile');
    Route::get('/profile/{user}', [ProfileController::class, 'show'])->name('profile.show');
    Route::get('/repositories/create', [RepositoryController::class, 'create'])->name('repositories.create');
    Route::post('/repositories', [RepositoryController::class, 'store'])->name('repositories.store');
    Route::get('/repositories/{repository}', [RepositoryController::class, 'show'])->name('repositories.show');

    // Account Settings Routes
    Route::get('/account/settings', [AccountSettingsController::class, 'show'])->name('account.settings');
    Route::patch('/account/name', [AccountSettingsController::class, 'updateName'])->name('account.update-name');
    Route::patch('/account/avatar', [AccountSettingsController::class, 'updateAvatar'])->name('account.update-avatar');
    Route::patch('/account/password', [AccountSettingsController::class, 'updatePassword'])->name('account.update-password');
    Route::delete('/account', [AccountSettingsController::class, 'deleteAccount'])->name('account.delete');

    // User Search Route
    Route::get('/search', [UserSearchController::class, 'index'])->name('users.search');
});

