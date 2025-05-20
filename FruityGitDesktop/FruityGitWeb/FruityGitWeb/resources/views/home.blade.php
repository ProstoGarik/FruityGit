@extends('layouts.app')

@section('content')
<div class="container">
    <div class="row justify-content-center">
        <div class="col-md-8">
            <div class="card">
                <div class="card-header">{{ __('Dashboard') }}</div>

                <div class="card-body">
                    @if (session('status'))
                        <div class="alert alert-success" role="alert">
                            {{ session('status') }}
                        </div>
                    @endif

                    {{ __('You are logged in!') }}
                    <div class="mt-3">
                        @if(isset($repositories) && $repositories->count() > 0)
                            {{-- Show repositories list if you have any --}}
                            @foreach($repositories as $repo)
                                <div>{{ $repo->name }}</div>
                            @endforeach
                        @else
                            {{ __('No repositories') }} :(
                        @endif
                        
                        <div class="mt-3">
                            <a href="{{ route('repositories.create') }}" class="btn btn-primary">
                                {{ __('Create New Repository') }}
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
@endsection