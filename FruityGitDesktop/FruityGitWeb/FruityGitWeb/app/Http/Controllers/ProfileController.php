<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;

class ProfileController extends Controller
{
    public function show(User $user = null)
    {
        // If no user is provided, show the authenticated user's profile
        $user = $user ?? auth()->user();
        
        // Load the user's repositories
        $repositories = $user->repositories()
            ->latest()
            ->get();

        return view('profile.show', [
            'user' => $user,
            'repositories' => $repositories,
            'isOwnProfile' => $user->id === auth()->id()
        ]);
    }

    public function getAvatarUrlAttribute()
    {
        if ($this->avatar_url) {
            return $this->avatar_url;
        }
    
        // Fallback to Gravatar
        $hash = md5(strtolower(trim($this->email)));
        return "https://www.gravatar.com/avatar/{$hash}?d=identicon&s=200";
    }
}