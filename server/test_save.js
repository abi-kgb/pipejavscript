
async function testSave() {
    const payload = {
        user_id: null,
        name: 'Test Project ' + Date.now(),
        components_json: JSON.stringify([{ id: '1', type: 'straight' }]),
        bom_json: JSON.stringify({ straight_pvc: 1 }),
        image_data: 'data:image/jpeg;base64,...'
    };

    try {
        console.log('Testing Save to /api/projects...');
        const res = await fetch('http://localhost:5000/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        console.log('Response status:', res.status);
        console.log('Response data:', data);
        if (res.ok) {
            console.log('✅ Save successful!');
        } else {
            console.log('❌ Save failed:', data.error);
        }
    } catch (err) {
        console.error('❌ Request failed:', err.message);
    }
}

testSave();
