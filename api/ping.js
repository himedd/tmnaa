export const config = {
  runtime: 'edge',
};

export default function handler(request) {
  const accounts = [];
  for (let i = 1; i <= 4; i++) {
    if (process.env[`STORJ${i}_ACCESS_KEY`] && process.env[`STORJ${i}_SECRET_KEY`] && process.env[`STORJ${i}_BUCKET`]) {
      accounts.push(i);
    }
  }
  return new Response(
    JSON.stringify({
      pong: true,
      hasSupabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE),
      hasAdmin: Boolean(process.env.ADMIN_USER_ID),
      storjAccounts: accounts,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    },
  );
}