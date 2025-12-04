# Deploying to Netlify

## Quick Deployment Steps

### Option 1: Drag and Drop (Fastest for Tomorrow)

1. **Prepare files locally:**
   - All files are already ready in this directory
   - No build process needed (pure HTML/CSS/JS)

2. **Go to Netlify:**
   - Visit https://app.netlify.com/drop
   - Drag the entire `gymnastics-graphics` folder onto the page
   - Wait for deployment (usually 30-60 seconds)
   - You'll get a URL like: `https://random-name-12345.netlify.app`

3. **Update your bookmarks:**
   - Dashboard: `https://your-site.netlify.app/dashboard.html`
   - Save this URL for accessing during broadcast

### Option 2: Git Deploy (Better for Updates)

1. **Initialize Git (if not already done):**
   ```bash
   git add .
   git commit -m "Add multi-competition support"
   git push origin main
   ```

2. **Connect to Netlify:**
   - Log into https://app.netlify.com
   - Click "Add new site" → "Import an existing project"
   - Connect to GitHub and select your repository
   - Build settings:
     - Build command: (leave empty)
     - Publish directory: (leave empty or set to `/`)
   - Click "Deploy site"

3. **Custom domain (optional):**
   - Go to Site settings → Domain management
   - Add your custom domain
   - Update DNS as instructed

## Configuration

### Build Settings
```
Build command: (none)
Publish directory: /
```

No build process is required - everything runs in the browser.

### Environment Variables
None required - Firebase config is already in the code.

### Redirects (Optional)
Create `netlify.toml` in the root if you want `/` to redirect to dashboard:

```toml
[[redirects]]
  from = "/"
  to = "/dashboard.html"
  status = 200
```

## Post-Deployment

### 1. Test the System
Visit your Netlify URL:
- Open `/dashboard.html`
- Create a test competition (id: `test`)
- Open controller and output in separate tabs
- Verify graphics switch properly
- Delete test competition

### 2. Create Your 3 Competitions
In the dashboard, create:
- Competition ID: `court1`
- Competition ID: `court2`
- Competition ID: `court3`

Fill in all meet details for each.

### 3. Set Up OBS
Add 3 Browser Sources with these URLs:
- `https://your-site.netlify.app/output.html?comp=court1`
- `https://your-site.netlify.app/output.html?comp=court2`
- `https://your-site.netlify.app/output.html?comp=court3`

### 4. Open Controllers
From dashboard, click "Open Controller" for each competition.
Bookmark these URLs for quick access during broadcast.

## Updating After Deployment

### Via Git:
```bash
git add .
git commit -m "Update graphics"
git push origin main
```
Netlify auto-deploys in ~30 seconds.

### Via Netlify UI:
- Go to Deploys tab
- Drag and drop files to "Drop to update" area

## Performance Tips

1. **Enable Asset Optimization:**
   - Go to Site settings → Build & deploy → Post processing
   - Enable: "Bundle CSS" and "Minify CSS, JS, and HTML"

2. **OBS Settings:**
   - Set "Shutdown source when not visible" to save resources
   - Don't refresh browser sources unnecessarily
   - Keep only active competition scenes active

3. **Firebase:**
   - Database is already optimized for real-time updates
   - Each competition uses separate paths (no conflicts)

## Troubleshooting

### Site not loading
- Check Netlify deploy log for errors
- Verify all files were uploaded
- Try hard refresh (Cmd+Shift+R / Ctrl+Shift+F5)

### Firebase not connecting
- Check browser console for errors
- Verify Firebase credentials are correct
- Check Firebase project is active (console.firebase.google.com)

### Graphics not updating
- Check competition ID in URL matches controller
- Verify Firebase database rules allow read/write
- Check browser console in OBS (right-click → Interact)

## Firebase Database Rules

Make sure your Firebase Realtime Database rules allow read/write:

```json
{
  "rules": {
    "competitions": {
      ".read": true,
      ".write": true
    }
  }
}
```

**⚠️ Note:** These are permissive rules for ease of use. For production, consider authentication.

## Backup Strategy

Your competition data is stored in Firebase. To backup:

1. Go to Firebase Console
2. Navigate to Realtime Database
3. Click the 3-dot menu → Export JSON
4. Save the JSON file

To restore:
1. Import JSON back to Firebase
2. Or recreate competitions in dashboard

## Going Live Checklist

- [ ] Site deployed to Netlify
- [ ] Dashboard accessible
- [ ] 3 competitions created and configured
- [ ] OBS browser sources added with correct URLs
- [ ] Controllers tested and bookmarked
- [ ] Graphics switching works independently per competition
- [ ] Keyboard shortcuts tested (1-20, Space)
- [ ] Team logos uploaded and URLs added
- [ ] Backup competition config saved (optional)

## Support Resources

- Netlify Status: https://www.netlifystatus.com/
- Firebase Status: https://status.firebase.google.com/
- Check browser console for JavaScript errors
- Firebase console for database monitoring

Good luck with tomorrow's broadcast! 🤸
