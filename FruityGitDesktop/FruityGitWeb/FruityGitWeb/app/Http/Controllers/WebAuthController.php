<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Providers\RouteServiceProvider;

class WebAuthController extends Controller
{
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required'],
        ]);

        if (Auth::attempt($credentials)) {
            $request->session()->regenerate();
            
            // Check if there's a callback URL from the desktop app
            $callback = $request->query('callback');
            if ($callback && str_starts_with($callback, 'fruitygit://')) {
                // Generate token for the desktop app
                $token = auth()->user()->createToken('desktop-app')->plainTextToken;
                
                // Redirect to the desktop app with the token
                return redirect($callback . '?token=' . urlencode($token));
            }

            return redirect()->intended('dashboard');
        }

        return back()->withErrors([
            'email' => 'The provided credentials do not match our records.',
        ])->withInput($request->except('password'));
    }

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return redirect('/');
    }
} 