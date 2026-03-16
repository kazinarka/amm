// #![deny(missing_docs)]

//! An Uniswap-like program for the Solana blockchain.
#[macro_use]
pub mod log;

mod entrypoint;
pub mod error;
pub mod instruction;
pub mod invokers;
pub mod math;
pub mod processor;
pub mod state;

// Export current solana-sdk types for downstream users who may also be building with a different solana-sdk version
pub use solana_program;

#[cfg(not(feature = "no-entrypoint"))]
solana_security_txt::security_txt! {
    name: "solana-amm",
    project_url: "https://github.com/kazinarka/amm",
    contacts: "",
    policy: "",
    source_code: "https://github.com/kazinarka/amm",
    preferred_languages: "en",
    auditors: ""
}

#[cfg(feature = "devnet")]
solana_program::declare_id!("8ZSENLftX5F1C9QRBnnvJ3VpvEfndtZ9ooqWp9ZveDaB");
#[cfg(not(feature = "devnet"))]
solana_program::declare_id!("5a7E8KEBTUNTRyYTCYAEkdpisZQ8R49Y3RjTpReWSCrk");
