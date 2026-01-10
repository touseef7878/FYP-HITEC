# Testing Guide

## Overview

This project uses Vitest for testing the Marine Detection System frontend. The test suite covers authentication, detection processing, API integration, LSTM predictions, admin features, and more.

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui
```

## Test Structure

### Setup (`setup.ts`)
- Configures the testing environment
- Mocks browser APIs (matchMedia, IntersectionObserver)
- Includes @testing-library/jest-dom matchers
- Runs cleanup after each test

### Comprehensive Tests (`comprehensive.test.tsx`)
Covers all major functionality:

- **Authentication Flow**: Login, logout, token management
- **Detection Processing**: Filtering, grouping, sorting detections
- **File Validation**: Video file type and size validation
- **API Integration**: Fetch operations, error handling, HTTP responses
- **LSTM Predictions**: Probability validation, environmental factors
- **Admin Dashboard**: User management, role updates, detection counts
- **Data Visualization**: Chart formatting, statistics calculations
- **Error Handling**: Validation, missing data, parsing errors
- **User Preferences**: Theme, notifications, settings
- **Date/Time Handling**: Timestamp formatting, time calculations

## Test Coverage

Current test suite includes:
- 41+ passing tests
- Unit tests for core functionality
- Integration tests for API calls
- Validation tests for user inputs

## Adding New Tests

1. Create a new test file in `src/tests/`
2. Import necessary testing utilities:
   ```typescript
   import { describe, it, expect, beforeEach, vi } from 'vitest';
   ```
3. Follow the existing test structure
4. Run tests to verify

## Best Practices

- Use `beforeEach` for test setup
- Mock external dependencies (API calls, localStorage)
- Test both success and error cases
- Keep tests focused and isolated
- Use descriptive test names
