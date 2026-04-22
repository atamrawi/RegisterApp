const request = require('supertest');
const express = require('express');
const session = require('express-session');
const User = require('../models/users');

// Completely mock the 'User' Mongoose model to ensure isolated tests
const mockSave = jest.fn();

jest.mock('../models/users', () => {
    return jest.fn().mockImplementation((data) => ({
        ...data,
        save: mockSave
    }));
});

// We also mock multer to prevent it from touching the disk or requiring actual multipart/form-data parsing during unit tests
jest.mock('multer', () => {
    const multerMock = () => ({
        single: () => (req, res, next) => {
            // Check body for a flag we can use to simulate a missing file payload easily
            if (req.body && req.body.simulateMissingFile) {
                req.file = undefined;
            } else {
                // Return a dummy req.file
                req.file = { filename: 'mock_image_123.png', originalname: 'test.png' };
            }
            next();
        }
    });
    // Mock the diskStorage property used in routes.js
    multerMock.diskStorage = jest.fn();
    return multerMock;
});

// Import the router AFTER mocking its dependencies
const routes = require('../routes/routes');

const app = express();

// Basic middlewares required for body parsing and sessions for the test environment
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: true
}));

// In-memory interceptor to capture the session object locally for our assertions
let sessionData = {};
app.use((req, res, next) => {
    res.on('finish', () => {
        if (req.session) {
            sessionData = req.session;
        }
    });
    next();
});

app.use('/', routes);

describe('POST /add - Add User Handler', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        mockSave.mockReset();
        sessionData = {};
    });

    test('1. should create a new user successfully (Primary Success Scenario)', async () => {
        // Arrange
        mockSave.mockResolvedValue(true);

        const userData = {
            name: 'John Doe',
            email: 'john.doe@example.com',
            phone: '1234567890'
        };

        // Act
        const response = await request(app)
            .post('/add')
            .send(userData);

        // Assert
        expect(response.status).toBe(302);
        expect(response.header.location).toBe('/');
        
        // Assert the constructor was called with the right data (includes the image from mocked multer)
        expect(User).toHaveBeenCalledTimes(1);
        expect(User).toHaveBeenCalledWith({
            name: 'John Doe',
            email: 'john.doe@example.com',
            phone: '1234567890',
            image: 'mock_image_123.png'
        });

        // Assert save was called
        expect(mockSave).toHaveBeenCalledTimes(1);
        
        // Assert the correct success message was placed into the session
        expect(sessionData.message).toEqual({
            type: 'success',
            message: 'User added successfully'
        });
    });

    test('2. should handle missing image and use default "user_unknown.png" (Edge case)', async () => {
        // Arrange
        mockSave.mockResolvedValue(true);

        const userData = {
            name: 'Jane Doe',
            email: 'jane.doe@example.com',
            phone: '0987654321',
            simulateMissingFile: true // Tells the mock multer to not attach req.file
        };

        // Act
        const response = await request(app)
            .post('/add')
            .send(userData);

        // Assert
        expect(response.status).toBe(302);
        
        // Ensure "image" field defaulted appropriately for the new instance
        expect(User).toHaveBeenCalledWith({
            name: 'Jane Doe',
            email: 'jane.doe@example.com',
            phone: '0987654321',
            image: 'user_unknown.png' 
        });
    });

    test('3. should handle errors and set danger message in session (e.g. Duplicate/existing user) (Edge case)', async () => {
        // Arrange
        const dbErrorMsg = 'Duplicate key error: User already exists';
        mockSave.mockRejectedValue(new Error(dbErrorMsg)); // Simulating a Mongoose db rejection

        const userData = {
            name: 'Duplicate User',
            email: 'original@example.com',
            phone: '1111111111'
        };

        // Act
        const response = await request(app)
            .post('/add')
            .send(userData);

        // Assert
        expect(response.status).toBe(302);
        expect(response.header.location).toBe('/');
        
        expect(User).toHaveBeenCalledTimes(1);
        expect(mockSave).toHaveBeenCalledTimes(1);
        
        // Assert the error details were added to the session object correctly due to the rejected promise
        expect(sessionData.message).toEqual({
            type: 'danger',
            message: dbErrorMsg
        });
    });

});
