@extends('layouts.app')

@section('content')
<div class="container">
    <div class="row justify-content-center">
        <div class="col-md-8">
            <div class="card">
                <div class="card-header">{{ __('Create New Repository') }}</div>

                <div class="card-body">
                    <form method="POST" action="{{ route('repositories.store') }}">
                        @csrf

                        <div class="mb-3">
                            <label for="name" class="form-label">{{ __('Repository Name') }}</label>
                            <input type="text" class="form-control" id="name" name="name" required>
                        </div>

                        <div class="mb-3 form-check">
                            <input type="checkbox" class="form-check-input" id="is_private" name="is_private">
                            <label class="form-check-label" for="is_private">{{ __('Make private') }}</label>
                        </div>

                        <button type="submit" class="btn btn-primary">
                            {{ __('Create Repository') }}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
@endsection