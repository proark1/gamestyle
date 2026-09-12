/* eslint-disable next/no-html-link-for-pages -- Links leave for full pages, like the rest of the site. */
import type { Metadata } from 'next';
import './privacy.css';

export const metadata: Metadata = {
  title: 'Privacy — Jumbleyard',
  description: 'What Jumbleyard stores, why, and for how long.',
};

/** Fill in before sign-in goes live: who runs Jumbleyard and how to reach them. */
const OPERATOR: { name: string; address: string; email: string } | null = null;

const COOKIES = [
  ['__Host-jy_session', 'Keeps you signed in', '60 days after your last visit'],
  [
    'jy_signed_in',
    'Tells the games you may be signed in; holds no account details',
    'As long as your session',
  ],
  [
    '__Host-jy_email_flow',
    'Ties an email code to the browser that asked for it',
    '30 minutes',
  ],
  [
    '__Host-jy_google_flow',
    'Protects Google sign-in against forged requests',
    '10 minutes',
  ],
  [
    'bodge_build_shelf',
    'Finds the builds you saved in Permit Pending',
    '1 year',
  ],
];

export default function PrivacyPage() {
  return (
    <main className="privacy">
      <a className="privacy-back" href="/">
        ← All games
      </a>
      <h1>Privacy</h1>
      <p className="privacy-updated">Last updated 12 September 2026</p>
      <p>
        Jumbleyard is a collection of browser party games. You can play every
        game without an account. This page explains what is stored, why, and for
        how long.
      </p>

      <h2>Who is responsible</h2>
      {OPERATOR ? (
        <p>
          {OPERATOR.name}, {OPERATOR.address}.{' '}
          <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>
        </p>
      ) : (
        <p>
          The name and contact details of the person responsible for Jumbleyard
          will be listed here.
        </p>
      )}

      <h2>Playing without an account</h2>
      <ul>
        <li>
          <b>In your browser.</b> Each game remembers your player name, colour
          and sound settings in your browser’s storage, and the room you are in
          for the current tab.
        </li>
        <li>
          <b>Rooms.</b> When you create or join a room, the server keeps your
          player name, colour and a random room pass so the other players can
          see you. Rooms are deleted a day after their last activity.
        </li>
        <li>
          <b>Voice chat</b> stays off until you turn it on. Nothing is recorded.
        </li>
        <li>
          <b>Anonymous play statistics.</b> Each visit reports a random number
          that exists only while the page is open, the kind of device (touch or
          mouse), how you arrived, how far you got, round results and time
          spent. Reports contain no cookies, names, chat or IP addresses, and
          they are deleted after 180 days.
        </li>
      </ul>

      <h2>If you create an account</h2>
      <ul>
        <li>
          <b>What is stored:</b> a random account number; for email sign-in, a
          keyed fingerprint of your email address instead of the address itself,
          plus a hint such as p•••@example.com so you can recognise it; for
          Google sign-in, Google’s id number for your account; the name you
          choose, if any; and when these were created and last used.
        </li>
        <li>
          <b>What is not stored:</b> a password (there is none), your Google
          name or photo, or your IP address.
        </li>
        <li>
          <b>Sign-in codes</b> are kept only as fingerprints, work for 10
          minutes and are deleted after a day.
        </li>
        <li>
          <b>Staying signed in:</b> a cookie keeps you signed in on a device for
          60 days after your last visit. Only a fingerprint of it is stored.
        </li>
        <li>
          <b>Why:</b> to provide the account you asked for (Article 6(1)(b)
          GDPR).
        </li>
        <li>
          <b>Deleting it:</b> use “Delete account” in your account. That removes
          the account and everything saved with it at once.
        </li>
        <li>If you are under 16, ask a parent before you create an account.</li>
      </ul>

      <h2>Cookies</h2>
      <p>
        Every cookie is needed for something you asked for, so there is no
        cookie banner.
      </p>
      <div className="privacy-table">
        <table>
          <thead>
            <tr>
              <th>Cookie</th>
              <th>Why</th>
              <th>How long</th>
            </tr>
          </thead>
          <tbody>
            {COOKIES.map(([name, why, lasts]) => (
              <tr key={name}>
                <td>
                  <code>{name}</code>
                </td>
                <td>{why}</td>
                <td>{lasts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Services Jumbleyard uses</h2>
      <ul>
        <li>
          <b>Railway</b> runs the server and database in the Netherlands. Its
          network may keep technical logs, including IP addresses, for security.
        </li>
        <li>
          <b>Google</b>, only if you choose Google sign-in, confirms who you are
          and sends your account id and email address.
        </li>
        <li>
          <b>Resend</b>, only if you choose email sign-in, delivers the email
          with your code.
        </li>
      </ul>

      <h2>Your rights</h2>
      <p>
        You can ask to see, correct, export or delete your data, and you can
        complain to a data protection authority. Deleting your account removes
        it straight away; for anything else, use the contact details above.
      </p>
    </main>
  );
}
