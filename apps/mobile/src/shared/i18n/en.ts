export const copy = {
  onboarding: {
    wordmark: "Sanduqkin",
    title: "A safe place for what your family needs to know.",
    subtitle:
      "Accounts, documents, and instructions — sealed on your phone, ready for your kin when it matters.",
    primaryAction: "Create your vault",
    signInLink: "I already have an account",
  },
  trustFaq: [
    {
      question: "What is Sanduqkin for?",
      answer:
        "Sanduqkin is a private vault for the information your family may need one day — such as accounts, property, insurance, pensions, subscriptions, important contacts, and instructions.",
    },
    {
      question: "How is my information protected?",
      answer:
        "Your vault details are encrypted on your device before they are stored remotely. The readable version stays inside your unlocked app; the server receives encrypted data instead.",
    },
    {
      question: "Can Sanduqkin read my vault?",
      answer:
        "No. Sanduqkin does not receive the key needed to read your saved details. We may store limited account and record metadata, but sensitive vault contents remain encrypted.",
    },
    {
      question: "What if the server is breached?",
      answer:
        "A database breach should expose encrypted vault records, not readable account numbers, notes, contacts, or instructions. Strong encryption reduces risk, although no digital service can promise zero risk.",
    },
    {
      question: "Why do I need a strong password?",
      answer:
        "Your password protects access to your account and helps secure the key that opens your vault. Use a unique password of at least 12 characters that you do not reuse anywhere else.",
    },
    {
      question: "What is the recovery phrase?",
      answer:
        "It is a 12-word backup that can restore access to your encrypted vault and let you set a new password. Write it down in order and keep it somewhere private, offline, and separate from your phone.",
    },
    {
      question: "Can Sanduqkin recover my phrase?",
      answer:
        "No. We never receive a readable copy of your recovery phrase and cannot recreate it for you. This protects your privacy, but it also means you must keep your written copy safe.",
    },
    {
      question: "What if I lose or replace my phone?",
      answer:
        "Install Sanduqkin on the new device, sign in, and use your 12-word recovery phrase when recovery is needed. Your encrypted records can then be opened with restored key access.",
    },
    {
      question: "Does biometrics replace my password?",
      answer:
        "No. Face or fingerprint unlock is an optional convenience on a device you already trust. Your password, recovery phrase, and device security remain important parts of protecting the vault.",
    },
    {
      question: "How can my next of kin be prepared?",
      answer:
        "You can create a sealed emergency code and give it to your chosen person, or store it with important papers. It is designed to help unlock encrypted access only through Sanduqkin's emergency-access process.",
    },
    {
      question: "Can someone use the emergency code today?",
      answer:
        "The code alone does not display or email your vault. The recipient will need Sanduqkin's approved claim and identity-review flow; that full next-of-kin activation service is not yet available in this release.",
    },
    {
      question: "Can Sanduqkin replace my emergency code?",
      answer:
        "No. The code is shown once so you can write it down. After confirmation, Sanduqkin keeps only sealed key material and cannot show the same code again. You can revoke it or generate a new one.",
    },
    {
      question: "Will my vault be sent automatically?",
      answer:
        "No. Creating a vault or emergency code does not automatically send your information to anyone. Emergency access requires a separate controlled process intended to prevent premature or fraudulent access.",
    },
    {
      question: "Can I make a readable backup?",
      answer:
        "Yes. From an unlocked vault you can create a readable PDF locally on your device. Sanduqkin does not receive or email that file, so anyone who gets the PDF may read it — store or delete it carefully.",
    },
    {
      question: "What happens when I delete information?",
      answer:
        "Deleted vault records are permanently removed and cannot be restored by Sanduqkin. Account deletion also removes encrypted vault data and key material, so the app asks you to confirm destructive actions carefully.",
    },
  ],
} as const;
