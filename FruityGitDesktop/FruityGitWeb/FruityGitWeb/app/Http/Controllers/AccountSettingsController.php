<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

class AccountSettingsController extends Controller
{
    public function show()
    {
        return view('account.settings');
    }

    public function updateName(Request $request)
    {
        $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $user = auth()->user();
        $user->name = $request->name;
        $user->save();

        return back()->with('success', 'Name updated successfully.');
    }

    public function updateAvatar(Request $request)
    {
        $request->validate([
            'avatar' => ['required', 'image', 'max:2048'], // 2MB max
        ]);

        $user = auth()->user();

        if ($request->hasFile('avatar')) {
            // Delete old avatar if exists and it's not the default avatar
            if ($user->avatar_url && !str_contains($user->avatar_url, 'DefaultPfp.png')) {
                $oldPath = str_replace('/storage/', '', $user->avatar_url);
                if (Storage::disk('public')->exists($oldPath)) {
                    Storage::disk('public')->delete($oldPath);
                }
            }

            // Generate unique filename using user ID and random string
            $extension = $request->file('avatar')->getClientOriginalExtension();
            $filename = 'user_' . $user->id . '_' . Str::random(10) . '.' . $extension;
            
            // Store in public disk under avatars directory
            $path = $request->file('avatar')->storeAs('avatars', $filename, 'public');
            
            // Update user's avatar_url with the storage URL
            $user->avatar_url = '/storage/' . $path;
            $user->save();
        }

        return back()->with('success', 'Profile picture updated successfully.');
    }

    public function updatePassword(Request $request)
    {
        $request->validate([
            'current_password' => ['required', 'current_password'],
            'password' => ['required', 'confirmed', Password::defaults()],
        ]);

        $user = auth()->user();
        $user->password = Hash::make($request->password);
        $user->save();

        return back()->with('success', 'Password updated successfully.');
    }

    public function deleteAccount(Request $request)
    {
        $request->validate([
            'password' => ['required', 'current_password'],
        ]);

        $user = auth()->user();
        
        // Delete avatar if exists and it's not the default avatar
        if ($user->avatar_url && !str_contains($user->avatar_url, 'DefaultPfp.png')) {
            $path = str_replace('/storage/', '', $user->avatar_url);
            if (Storage::disk('public')->exists($path)) {
                Storage::disk('public')->delete($path);
            }
        }

        // Delete user
        $user->delete();

        // Logout
        auth()->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/')->with('success', 'Your account has been deleted.');
    }
} 