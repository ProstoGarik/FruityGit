<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class ProfileController extends Controller
{
    public function show()
    {
        // Get the authenticated user
        $user = auth()->user();
        
        return view('profile.show', compact('user'));
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