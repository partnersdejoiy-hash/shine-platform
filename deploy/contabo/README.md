# Shine on the Dejoiy Mail server (Contabo)

Shine runs next to Dejoiy Mail: the same nginx, the same Let's Encrypt setup, and
accounts from Dejoiy Mail (Zimbra). Anyone signed in to mail.dejoiy.com is signed in
to Shine too, and mail.dejoiy.com shows Shine's chats in a docked chat panel.

## DNS (once)

Point these names at the mail server (`173.249.23.93`):

| Type | Name | Value |
|---|---|---|
| A | `app.shine` | `173.249.23.93` (change from the old `178.104.228.157`) |
| A | `convex.shine` | `173.249.23.93` (new: Shine's backend API) |
| A | `convex-site.shine` | `173.249.23.93` (new: sign-in endpoints) |

Optional: `meet` (meet.dejoiy.com) can move later; it still points at the old server.

## Install (once)

```bash
git clone -b feat/gen-z-look https://github.com/partnersdejoiy-hash/shine-platform /opt/shine
bash /opt/shine/deploy/contabo/install.sh
```

The script checks DNS, installs Docker if missing, starts the backend (Convex in
Docker, ports bound to 127.0.0.1), creates the shared sign-in secret in
`/etc/dmail/adapter.env` (and restarts dmail), gets the certificate, writes the
nginx site and builds the app. Secrets stay in `/etc/shine` (root only).

## Update

```bash
bash /opt/shine/deploy/contabo/update.sh
```

## Moving the old data (users, chats, files)

The new backend starts empty. To bring the old data over, export it from the old
deployment and import it here:

```bash
# where the old deployment lives (its URL and admin/deploy key)
npx convex export --path shine-backup.zip
# on this server
cp shine-backup.zip /opt/shine/
docker run --rm --network host -v /opt/shine:/app -w /app \
  -e CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210 \
  -e CONVEX_SELF_HOSTED_ADMIN_KEY="$(cat /etc/shine/admin-key)" \
  node:22-bookworm npx convex import --replace-all -y shine-backup.zip
```

## Where things are

| What | Where |
|---|---|
| Backend data | Docker volume `shine_data` |
| Backend logs | `docker compose -p shine -f /opt/shine/deploy/contabo/docker-compose.yml logs -f backend` |
| Web app files | `/var/www/shine` |
| nginx site | `/etc/nginx/sites-available/shine` |
| Secrets | `/etc/shine/` and `SHINE_SSO_SECRET` in `/etc/dmail/adapter.env` |
| Admin dashboard | `ssh -L 6791:127.0.0.1:6791 root@173.249.23.93`, then http://localhost:6791 with `/etc/shine/admin-key` |

## Joi in Shine

Joi (DEJOIY's AI buddy) is a Shine member with her own **#joi** channel. She answers everything in #joi,
in direct chats with her, and wherever someone writes **@Joi**. Every morning (Mon to Sat, 9:17 IST) she posts in #joi,
and she tells #joi when mail arrives in her inbox (joi-ai@mail.dejoiy.com).

1. On Joi's admin page (`/?view=admin`), open the **Shine** app, make sure "Internal DEJOIY app" is on, and copy its secret.
2. On this server, create `/etc/shine/joi.env` (mode 600):
   ```
   JOI_API_URL=https://<Joi's API, e.g. joi-api.130-210-33-30.sslip.io>
   JOI_APP_SECRET=<the Shine secret from step 1>
   ```
3. Run `bash /opt/shine/deploy/contabo/update.sh`. Within 30 minutes (or right away with
   `npx convex run joi:ensureJoi`) Joi and #joi appear, with everyone in the company added once.
4. On the Joi server set `SHINE_JOI_URL=https://convex-site.shine.dejoiy.com/joi/post` so Joi can post by herself.
