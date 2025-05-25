<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Auth;
use App\Http\Controllers\{ProfileController, RepositoryController, WebAuthController};


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
    return view('home');
});

// Authentication Routes
Route::get('/login', function () {
    return view('auth.login');
})->name('login')->middleware('guest');

Route::post('/login', [WebAuthController::class, 'login'])->name('login')->middleware('guest');
Route::post('/logout', [WebAuthController::class, 'logout'])->name('logout');

// Protected Routes
Route::middleware(['auth'])->group(function () {
    Route::get('/dashboard', function () {
        return view('dashboard');
    })->name('dashboard');
    
    Route::get('/profile', [ProfileController::class, 'show'])->name('profile');
    Route::get('/repositories/create', [RepositoryController::class, 'create'])->name('repositories.create');
    Route::post('/repositories', [RepositoryController::class, 'store'])->name('repositories.store');
    Route::get('/repositories/{repository}', [RepositoryController::class, 'show'])->name('repositories.show');
});

Auth::routes(['verify' => true]);

