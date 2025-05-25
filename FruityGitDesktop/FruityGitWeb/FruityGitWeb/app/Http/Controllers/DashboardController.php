<?php

namespace App\Http\Controllers;

use App\Models\Repository;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function index()
    {
        $latestRepositories = Repository::with('user')
            ->where('is_private', false)
            ->latest()
            ->paginate(10);

        return view('dashboard', [
            'repositories' => $latestRepositories
        ]);
    }
} 