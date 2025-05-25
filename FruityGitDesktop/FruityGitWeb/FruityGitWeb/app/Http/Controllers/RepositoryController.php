<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Repository;

class RepositoryController extends Controller
{
    public function create()
    {
        return view('repositories.create');
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'is_private' => 'boolean'
        ]);

        $repository = $request->user()->repositories()->create([
            'name' => $validated['name'],
            'is_private' => $validated['is_private'] ?? false
        ]);

        return redirect()->route('dashboard')->with('status', 'Repository created successfully!');
    }
}