# Real-Phone Test Checklist — Shaver Team

**Why this exists:** the automated audit runs in desktop browsers pretending to be phones. A few things only a real phone can show: whether the screen zooms when you tap a field, what the keyboard looks like, whether the keyboard covers anything, and how taps feel. This list covers exactly those. It takes about 15 minutes per phone.

**What you need**
- An iPhone with Safari, and an Android phone with Chrome if anyone on the team uses Android.
- A salesperson login and your admin login.
- Testing on the live site (team.shavercars.com) once the fixes are deployed. Use a real deal you were going to log anyway, or log a test deal and delete it after. **Never leave a test deal in.**

**How to record results:** tick each box. If something fails, take a screenshot and note the phone model, which screen, and what you saw.

---

## 1. Sign in (`/login`)

- [ ] Tap **Email**. The page does **not** zoom in.
- [ ] The keyboard shows an `@` key, and its return key says **Next**. Tapping it jumps to Password.
- [ ] On Password, the return key says **Go**. Tapping it signs you in.

**Pass looks like:** no zooming, no pinching needed, sign-in works from the keyboard.

## 2. Salesperson dashboard (`/dashboard`)

- [ ] The browser bar at the top is dark (near-black), not white. *(iPhone and Android may show this differently — just note it.)*
- [ ] Tap **Dashboard** and **History** in the menu. Each responds on the first tap.
- [ ] Tap the **←** and **→** month arrows. Each responds on the first tap and the month changes.
- [ ] **Units by month** chart: tap a bar. A little box shows that month's units. Tap the first bar and the last bar — the box stays on screen.
- [ ] **Month Pace** chart: tap anywhere on it. A box shows that day's numbers. Slide your finger sideways and the day changes.
- [ ] Put your finger on a chart and swipe **up**. The page still scrolls (the chart doesn't trap your finger).
- [ ] The yellow **Log Deal** button sits in the bottom-right corner, clear of the home bar at the bottom of the iPhone.

**Pass looks like:** every tap works the first time, chart numbers appear on tap, and scrolling feels normal.

## 3. Log a deal (`/deals/new`) — the most important one

- [ ] Tap each field in turn (Sale date, Customer name, Stock #, Deal #, Deal notes, Back gross). The page does **not** zoom in on any of them.
- [ ] **Customer name:** the keyboard's return key says **Next**.
- [ ] **Stock #:** the keyboard starts in **capital letters**.
- [ ] **Back gross:** a number keypad appears.
- [ ] While the keyboard is open, the field you're typing in stays visible (not hidden behind the keyboard).
- [ ] Tap the product boxes, **90 days** and **Multi-lingual**. Each ticks on the first tap, even if you tap the text next to the box.
- [ ] Open **Split deal with**. The list opens and is easy to pick from. *(Note how tall the box looks — the audit couldn't confirm this on iPhone.)*
- [ ] Scroll to the bottom. **Log deal** and **Cancel** are easy to hit.

**Pass looks like:** no zooming, the right keyboard for each field, nothing hidden behind the keyboard.

## 4. History (`/history`)

- [ ] The table shows **Month, Units, Best?, Total** and fits the screen. No sideways scrolling needed.
- [ ] Tap a month name. It opens that month's dashboard on the first tap.
- [ ] *(Optional)* Turn the phone sideways or use an iPad. More columns appear (2-Car, Hat Trick, Deals only).

## 5. Admin screens (admin login)

- [ ] **Menu:** the right edge fades out. Swipe the menu left to reach **Settings**.
- [ ] **Store:** tap **History** and **View as** under a salesperson. Each works on the first tap with no mis-taps.
- [ ] **View as:** the yellow bar at the top is one short line ("Viewing as …") with **Exit view**. Exit view works on the first tap.
- [ ] **Spiffs → Amount:** the keyboard has a **minus (−) key**, so you can type `-250` for a chargeback. *(Don't save — just check the keyboard.)*
- [ ] **Spiffs / Settings / Staff:** tap into a field near the bottom of the page. The yellow **Add Deal** button disappears while you type and comes back when you tap outside.
- [ ] **Staff → Reset password:** type a lowercase password. The phone does **not** capitalize the first letter or autocorrect it. *(Don't save.)*
- [ ] **Staff:** tap the Salesperson / Admin / Active checkboxes. Each ticks on the first tap. *(Don't save.)*
- [ ] **Deals:** tap **Edit** on a row. It opens on the first tap.

## 6. Phone settings checks (iPhone)

- [ ] **Bigger text:** Settings → Display & Brightness → Text Size, slide it up two notches. Reopen the app: nothing overlaps or gets cut off on Dashboard, Log Deal and History. *(Set it back after.)*
- [ ] **Reduce Motion:** Settings → Accessibility → Motion → Reduce Motion **on**. The app still works; buttons just stop "bouncing". *(Set it back after.)*
- [ ] **Pinch to zoom** still works on any screen (we never block zooming).

---

## Known, accepted differences

- **Chart month labels** are smaller (10px) on phones than elsewhere. That's deliberate, so all 12 months fit.
- **Admin filter chips** (Deals → All / No back gross, Settings section links) and the salesperson name links on Store are still small. They're logged for a later design pass (finding T-12).
- **Dropdown height** on iPhone is unknown until checked here (finding M-07).

**If everything ticks:** reply "phone checks passed" and the remaining "needs real device" items in `audit/MOBILE_AUDIT.md` can be marked done.
