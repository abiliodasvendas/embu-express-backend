import 'dotenv/config';

const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
    console.log("Key missing");
    process.exit(1);
}

const parts = key.split('.');
if (parts.length !== 3) {
    console.log("Key is not a valid JWT format (not 3 parts)");
    process.exit(1);
}

try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    console.log("--------------- KEY INSPECTION ---------------");
    console.log("ROLE CLAIM:", payload.role); // Should be 'service_role'
    console.log("----------------------------------------------");
    
    if (payload.role !== 'service_role') {
        console.log("❌ ERRO: A chave configurada é do tipo '" + payload.role + "'.");
        console.log("Para criar usuários, você PRECISA da chave 'service_role'.");
    } else {
        console.log("✅ A chave parece correta (tipo service_role).");
    }

} catch (e) {
    console.error("Error decoding:", e.message);
}
