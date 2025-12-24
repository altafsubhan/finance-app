# Debugging Authentication Issues

## Quick Checks

1. **Are you logged in?**
   - Check the browser console: `localStorage.getItem('sb-*')` should show Supabase session data
   - Check cookies: Look for cookies starting with `sb-` in browser DevTools → Application → Cookies

2. **Check Environment Variables**
   - Make sure `.env.local` has correct values
   - Restart dev server after changing `.env.local`

3. **Test Login**
   - Try logging out and logging back in
   - Check browser console for any errors during login

4. **Check Network Tab**
   - Open DevTools → Network
   - Make an API call (e.g., initialize categories)
   - Check the request headers - do you see cookies being sent?
   - Check the response - what's the exact error?

## Common Issues

### Issue: Cookies not being set
**Solution**: Make sure you're using the correct Supabase URL and the cookies domain matches

### Issue: Cookies not being sent
**Solution**: Check if `credentials: 'include'` is set on fetch requests (we added this)

### Issue: Server can't read cookies
**Solution**: Make sure middleware is running and cookies() function works

## Test Steps

1. **Clear everything and start fresh:**
   ```bash
   # Clear browser cookies/localStorage
   # Restart dev server
   npm run dev
   ```

2. **Login again:**
   - Go to /auth/login
   - Login with your credentials
   - Check browser console for errors

3. **Check if session exists:**
   - After login, check browser DevTools → Application → Cookies
   - You should see cookies like `sb-<project-ref>-auth-token`

4. **Test API call:**
   - Try initializing categories
   - Check Network tab to see if cookies are sent
   - Check the response

## If Still Not Working

The issue might be that Supabase SSR needs the cookies to be set with specific options. Let me know:
1. What cookies do you see in the browser?
2. What's the exact error in the Network tab?
3. Are cookies being sent with the API requests?

