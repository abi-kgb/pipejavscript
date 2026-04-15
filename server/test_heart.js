const axios = require('axios');

async function testToggle() {
    try {
        console.log('Fetching projects to find a valid ID...');
        const res = await axios.get('http://localhost:5173/api/projects');
        const projects = res.data;
        if (projects.length === 0) {
            console.log('No projects found to test.');
            return;
        }
        const id = projects[0].id;
        console.log(`Toggling favorite for project ID: ${id}`);
        const patchRes = await axios.patch(`http://localhost:5173/api/projects/${id}/favourite`);
        console.log('Response:', patchRes.data);
    } catch (err) {
        console.error('Error:', err.message);
        if (err.response) {
            console.error('Response Data:', err.response.data);
        }
    }
}

testToggle();
