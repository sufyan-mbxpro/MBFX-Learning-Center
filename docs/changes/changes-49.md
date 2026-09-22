the right cards & image top should be th same..
http://localhost:3000/learn/crypto/bitcoin-for-beginners
![alt text](image.png)

------
    add the FAQ seprately for the courses & add in the public site as well..

    ----
    ![alt text](image-1.png)
    make logo in center in both sidebar & site as well in mobile view

    -----
    ![alt text](<WhatsApp Image 2026-09-21 at 9.38.09 PM (1).jpeg>) ![alt text](<WhatsApp Image 2026-09-21 at 9.38.09 PM.jpeg>)

    the foooter stay loop banner color should be the same like the signIn banner..also the text should be in single line..also the reduce the size & padding as well..
    ----

    Follow us for the latest analysis, views and breaking news
    remove
    -----
    adminlogin link change to
/keystone

-----
admin side 
users section place after the content in sidebar

also add the favicon display when we collapse the sidebar then it should show the favicon...

----------
publish button directly
in courses & other sections there should be an option to publish directly..maintain the others as well

-----
add delete filter courses as well..do not show delted in all courses..
there should be an option to delete permanantly as well..

this delete option should follow all other omodules as well

-----
admin  & user dedicated light & dark mode mode color pallet..when admin change the light & dark color then this should not cahnge either side...
same color selections & presets should be available sepratley for the public & admin
& seprate cookies 

-----
logout session same for the both admin & user that will controle by admin

----
support email sent to that email added in general contact email..also mention desc in admin as well

---
[w](http://localhost:3000/legal/terms.pdf)

all the downloadble links should be the dynamically show as per deployed site..do not use static links

-----
also review the whole site for any links are used should be dynamically set as per site env url..

---
check the media settings dynamically working or not
media settings are working
------
we'll use embed video for the site
---
check the working or not seo google verification & added seo is implementing

---
sendgrid add option for email 
there should be an option to controle & set the sendgrid settings for email sending..also check the email are working as per template set..

----
there should be the same top banner size for the learn fore & crypto(all sub menue courses,videos,quizes,glossary),Glossary,analysis,news..
the current news top banner size should be implement on all these pages..
----
in tools there should be the same top banner hight for all the tools
----
the tools menu items should be adjusted in 5 tools in each columns..

-----
add economic calendar paginations & filters as per added buttons..should be real data..

----
http://localhost:3000/analysis

Top providers — market news
The latest headlines and analysis from leading financial news providers, gathered by TradingView.

the market news vidget should be display the top buttons real filter data & pagination as well..on click should display the filter data

---
![alt text](<WhatsApp Image 2026-09-21 at 9.43.13 PM.jpeg>)

in all media upload button should be display like this..if we need use the media click on that..show the both option of choose,media libary,choose web & upload form computer...
every editor should have a single media choose button..do not chosse seprate buttons for upload & use media..this will manage after updating the above media option...

-------
Follow us for the latest analysis, views and breaking news

remove this section form the home page
------
design the 404 page with coming soon message..
------


🔴 Soft-404: every unknown path returns 200 + the 350 KB homepage instead of a real 404 (e.g. /login, /dashboard, /profile, /LICENSE, random paths).
🔴 Any top-level path containing a dot returns 500 (/foo.txt, /README.md, /manifest.json, /package.json) — i18n middleware treats the segment as a locale and throws.
🟠 No HSTS header.
🟠 CSP is inert — report-only AND no reporting endpoint; also allows script-src 'unsafe-inline'.
🟠 Conflicting duplicate headers — referrer-policy sent twice with different values; x-frame-options and x-content-type-options doubled.
🟠 localhost:3003 leaked in the prod Link: (hreflang) header, and that header is emitted 5×.
🟠 x-powered-by: Next.js info leak.
🟠 NEXT_LOCALE cookie missing the Secure flag.
🟠 Admin login (/admin/sign-in) has no CAPTCHA, no rate-limiting, and 2FA not confirmed enforced. change the URL here as i told youI🟡 Public sign-up endpoint open (/api/auth/sign-up/email) — account/email-spam vector.
🟡 /account is client-side gated only (returns 200 to anonymous, though no PII leaked).
🟡 Admin route matcher is /admin* not /admin/* (/admin.json → 307).






