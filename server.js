const express = require('express');
const { PrismaClient } = require('@prisma/client');
const path = require('path');

const axios = require('axios');
const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- EXTERNAL SEARCH PROXY ---
app.post('/api/search', async (req, res) => {
    const { title, location, apiKey } = req.body;
    try {
        const response = await axios.get('https://jobs.indianapi.in/jobs', {
            params: { title, location, limit: 10 },
            headers: { 'X-Api-Key': apiKey }
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Search failed' });
    }
});

// --- JOB TRACKER API ---

// Get all tracked jobs
app.get('/api/jobs', async (req, res) => {
    try {
        const jobs = await prisma.job.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(jobs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch jobs' });
    }
});

// Add a job to tracker
app.post('/api/jobs', async (req, res) => {
    try {
        const { title, company, location, applyLink, jobDescription, matchScore } = req.body;
        const newJob = await prisma.job.create({
            data: { title, company, location, applyLink, jobDescription, matchScore }
        });
        res.json(newJob);
    } catch (error) {
        res.status(500).json({ error: 'Failed to save job' });
    }
});

// Update job status
app.patch('/api/jobs/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const updatedJob = await prisma.job.update({
            where: { id },
            data: { status }
        });
        res.json(updatedJob);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update status' });
    }
});

// Delete job
app.delete('/api/jobs/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.job.delete({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete job' });
    }
});

// --- RESUME PROFILE API ---

// Get resume
app.get('/api/profile', async (req, res) => {
    try {
        const profile = await prisma.profile.findUnique({
            where: { id: 'user-profile' }
        });
        res.json(profile || { resume: '' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Save resume
app.post('/api/profile', async (req, res) => {
    try {
        const { resume } = req.body;
        const profile = await prisma.profile.upsert({
            where: { id: 'user-profile' },
            update: { resume },
            create: { id: 'user-profile', resume }
        });
        res.json(profile);
    } catch (error) {
        res.status(500).json({ error: 'Failed to save profile' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
