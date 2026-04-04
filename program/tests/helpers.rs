#![allow(dead_code)]

use solana_program::pubkey::Pubkey;
use solana_program::system_program;
use solana_program_test::{processor, ProgramTest};
use solana_sdk::{
    account::Account,
    instruction::{AccountMeta, Instruction},
    signature::{Keypair, Signer},
    transaction::Transaction,
};
use solana_program::program_pack::Pack;
use solana_program_test::BanksClient;
use solana_sdk::hash::Hash;
use std::str::FromStr;

use solana_amm::processor::Processor;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

pub fn program_id() -> Pubkey {
    Pubkey::from_str("5a7E8KEBTUNTRyYTCYAEkdpisZQ8R49Y3RjTpReWSCrk").unwrap()
}

pub fn create_pool_fee_address() -> Pubkey {
    Pubkey::from_str("2fYQC1gCTuyNkEZgAUwWeYXrdhUJduWeJYsdDwQnqhdB").unwrap()
}

pub const AMM_CONFIG_SIZE: usize = 544;
pub const AMM_INFO_SIZE: usize = 752;
pub const TARGET_ORDERS_SIZE: usize = 2208;

// ---------------------------------------------------------------------------
// PDA derivation helpers
// ---------------------------------------------------------------------------

pub struct PoolPdas {
    pub amm_authority: Pubkey,
    pub nonce: u8,
    pub amm_config: Pubkey,
    pub amm_info: Pubkey,
    pub target_orders: Pubkey,
    pub coin_vault: Pubkey,
    pub pc_vault: Pubkey,
    pub lp_mint: Pubkey,
}

pub fn derive_pool_pdas(market_id: &Pubkey) -> PoolPdas {
    let pid = program_id();

    let (amm_authority, nonce) =
        Pubkey::find_program_address(&[b"amm authority"], &pid);
    let (amm_config, _) =
        Pubkey::find_program_address(&[b"amm_config_account_seed"], &pid);
    let (amm_info, _) = Pubkey::find_program_address(
        &[&pid.to_bytes(), &market_id.to_bytes(), b"amm_associated_seed"],
        &pid,
    );
    let (target_orders, _) = Pubkey::find_program_address(
        &[&pid.to_bytes(), &market_id.to_bytes(), b"target_associated_seed"],
        &pid,
    );
    let (coin_vault, _) = Pubkey::find_program_address(
        &[&pid.to_bytes(), &market_id.to_bytes(), b"coin_vault_associated_seed"],
        &pid,
    );
    let (pc_vault, _) = Pubkey::find_program_address(
        &[&pid.to_bytes(), &market_id.to_bytes(), b"pc_vault_associated_seed"],
        &pid,
    );
    let (lp_mint, _) = Pubkey::find_program_address(
        &[&pid.to_bytes(), &market_id.to_bytes(), b"lp_mint_associated_seed"],
        &pid,
    );

    PoolPdas {
        amm_authority,
        nonce,
        amm_config,
        amm_info,
        target_orders,
        coin_vault,
        pc_vault,
        lp_mint,
    }
}

// ---------------------------------------------------------------------------
// Test environment setup
// ---------------------------------------------------------------------------

/// Builds a 544-byte AmmConfig account with `create_pool_fee = 0` and pnl/cancel
/// owners set to the given pubkey.
fn build_amm_config_data(owner: &Pubkey) -> Vec<u8> {
    let mut data = vec![0u8; AMM_CONFIG_SIZE];
    // pnl_owner: bytes 0..32
    data[0..32].copy_from_slice(&owner.to_bytes());
    // cancel_owner: bytes 32..64
    data[32..64].copy_from_slice(&owner.to_bytes());
    // pending_1: bytes 64..288  (28 * 8 = 224) — leave zeros
    // pending_2: bytes 288..536 (31 * 8 = 248) — leave zeros
    // create_pool_fee: bytes 536..544 — 0u64
    data[536..544].copy_from_slice(&0u64.to_le_bytes());
    data
}

pub async fn setup_test_env() -> (BanksClient, Keypair, Hash) {
    let pid = program_id();

    let mut program_test = ProgramTest::new(
        "solana_amm",
        pid,
        processor!(Processor::process),
    );

    // We need a funded payer — ProgramTest creates one by default.
    // However, we need to know its pubkey for the AmmConfig before starting.
    // We'll use a deterministic payer keypair.
    let payer = Keypair::new();

    // Pre-load the hardcoded fee destination account (system-owned with SOL)
    program_test.add_account(
        create_pool_fee_address(),
        Account {
            lamports: 1_000_000_000,
            data: vec![],
            owner: system_program::id(),
            executable: false,
            rent_epoch: 0,
        },
    );

    // Pre-load the AmmConfig PDA with valid data, owned by the program
    let (amm_config_pda, _) =
        Pubkey::find_program_address(&[b"amm_config_account_seed"], &pid);
    let config_data = build_amm_config_data(&payer.pubkey());
    program_test.add_account(
        amm_config_pda,
        Account {
            lamports: 1_000_000_000,
            data: config_data,
            owner: pid,
            executable: false,
            rent_epoch: 0,
        },
    );

    // Fund the payer
    program_test.add_account(
        payer.pubkey(),
        Account {
            lamports: 100_000_000_000, // 100 SOL
            data: vec![],
            owner: system_program::id(),
            executable: false,
            rent_epoch: 0,
        },
    );

    let (banks_client, _default_payer, recent_blockhash) = program_test.start().await;
    (banks_client, payer, recent_blockhash)
}

// ---------------------------------------------------------------------------
// SPL token helpers
// ---------------------------------------------------------------------------

pub async fn create_spl_mint(
    banks_client: &mut BanksClient,
    payer: &Keypair,
    recent_blockhash: &Hash,
    decimals: u8,
) -> Pubkey {
    let mint = Keypair::new();
    let rent = banks_client.get_rent().await.unwrap();
    let mint_rent = rent.minimum_balance(spl_token::state::Mint::LEN);

    let tx = Transaction::new_signed_with_payer(
        &[
            solana_sdk::system_instruction::create_account(
                &payer.pubkey(),
                &mint.pubkey(),
                mint_rent,
                spl_token::state::Mint::LEN as u64,
                &spl_token::id(),
            ),
            spl_token::instruction::initialize_mint(
                &spl_token::id(),
                &mint.pubkey(),
                &payer.pubkey(),
                None,
                decimals,
            )
            .unwrap(),
        ],
        Some(&payer.pubkey()),
        &[payer, &mint],
        *recent_blockhash,
    );
    banks_client.process_transaction(tx).await.unwrap();
    mint.pubkey()
}

pub async fn create_token_account(
    banks_client: &mut BanksClient,
    payer: &Keypair,
    recent_blockhash: &Hash,
    mint: &Pubkey,
    owner: &Pubkey,
) -> Pubkey {
    let account = Keypair::new();
    let rent = banks_client.get_rent().await.unwrap();
    let account_rent = rent.minimum_balance(spl_token::state::Account::LEN);

    let tx = Transaction::new_signed_with_payer(
        &[
            solana_sdk::system_instruction::create_account(
                &payer.pubkey(),
                &account.pubkey(),
                account_rent,
                spl_token::state::Account::LEN as u64,
                &spl_token::id(),
            ),
            spl_token::instruction::initialize_account(
                &spl_token::id(),
                &account.pubkey(),
                mint,
                owner,
            )
            .unwrap(),
        ],
        Some(&payer.pubkey()),
        &[payer, &account],
        *recent_blockhash,
    );
    banks_client.process_transaction(tx).await.unwrap();
    account.pubkey()
}

pub async fn mint_tokens(
    banks_client: &mut BanksClient,
    payer: &Keypair,
    recent_blockhash: &Hash,
    mint: &Pubkey,
    dest: &Pubkey,
    amount: u64,
) {
    let tx = Transaction::new_signed_with_payer(
        &[spl_token::instruction::mint_to(
            &spl_token::id(),
            mint,
            dest,
            &payer.pubkey(),
            &[],
            amount,
        )
        .unwrap()],
        Some(&payer.pubkey()),
        &[payer],
        *recent_blockhash,
    );
    banks_client.process_transaction(tx).await.unwrap();
}

pub async fn get_token_balance(banks_client: &mut BanksClient, account: &Pubkey) -> u64 {
    let account_data = banks_client.get_account(*account).await.unwrap().unwrap();
    let token_account = spl_token::state::Account::unpack(&account_data.data).unwrap();
    token_account.amount
}

// ---------------------------------------------------------------------------
// Instruction builders
// ---------------------------------------------------------------------------

pub fn build_initialize2_ix(
    nonce: u8,
    open_time: u64,
    init_pc_amount: u64,
    init_coin_amount: u64,
    amm_info: &Pubkey,
    amm_authority: &Pubkey,
    amm_lp_mint: &Pubkey,
    coin_mint: &Pubkey,
    pc_mint: &Pubkey,
    coin_vault: &Pubkey,
    pc_vault: &Pubkey,
    target_orders: &Pubkey,
    amm_config: &Pubkey,
    market_id: &Pubkey,
    user_wallet: &Pubkey,
    user_coin: &Pubkey,
    user_pc: &Pubkey,
    user_lp: &Pubkey,
) -> Instruction {
    // Data: [1][nonce:u8][open_time:u64le][init_pc_amount:u64le][init_coin_amount:u64le]
    let mut data = Vec::with_capacity(26);
    data.push(1u8); // instruction tag
    data.push(nonce);
    data.extend_from_slice(&open_time.to_le_bytes());
    data.extend_from_slice(&init_pc_amount.to_le_bytes());
    data.extend_from_slice(&init_coin_amount.to_le_bytes());

    let accounts = vec![
        AccountMeta::new_readonly(spl_token::id(), false),                              // 0  token_program
        AccountMeta::new_readonly(spl_associated_token_account::id(), false),            // 1  ata_token_program
        AccountMeta::new_readonly(system_program::id(), false),                          // 2  system_program
        AccountMeta::new_readonly(solana_program::sysvar::rent::id(), false),            // 3  rent_sysvar
        AccountMeta::new(*amm_info, false),                                              // 4  amm_info
        AccountMeta::new_readonly(*amm_authority, false),                                // 5  amm_authority
        AccountMeta::new(*amm_lp_mint, false),                                           // 6  amm_lp_mint
        AccountMeta::new_readonly(*coin_mint, false),                                    // 7  coin_mint
        AccountMeta::new_readonly(*pc_mint, false),                                      // 8  pc_mint
        AccountMeta::new(*coin_vault, false),                                            // 9  coin_vault
        AccountMeta::new(*pc_vault, false),                                              // 10 pc_vault
        AccountMeta::new(*target_orders, false),                                         // 11 target_orders
        AccountMeta::new_readonly(*amm_config, false),                                   // 12 amm_config
        AccountMeta::new(create_pool_fee_address(), false),                              // 13 fee_dest
        AccountMeta::new_readonly(*market_id, false),                                    // 14 market_id
        AccountMeta::new(*user_wallet, true),                                            // 15 user_wallet (signer)
        AccountMeta::new(*user_coin, false),                                                // 16 user_coin (writable — token_transfer source)
        AccountMeta::new(*user_pc, false),                                                // 17 user_pc (writable — token_transfer source)
        AccountMeta::new(*user_lp, false),                                               // 18 user_lp
    ];

    Instruction {
        program_id: program_id(),
        accounts,
        data,
    }
}

pub fn build_deposit_ix(
    max_coin_amount: u64,
    max_pc_amount: u64,
    base_side: u64,
    amm_info: &Pubkey,
    amm_authority: &Pubkey,
    target_orders: &Pubkey,
    lp_mint: &Pubkey,
    coin_vault: &Pubkey,
    pc_vault: &Pubkey,
    user_coin: &Pubkey,
    user_pc: &Pubkey,
    user_lp: &Pubkey,
    user_owner: &Pubkey,
) -> Instruction {
    // Data: [3][max_coin:u64le][max_pc:u64le][base_side:u64le]
    let mut data = Vec::with_capacity(25);
    data.push(3u8);
    data.extend_from_slice(&max_coin_amount.to_le_bytes());
    data.extend_from_slice(&max_pc_amount.to_le_bytes());
    data.extend_from_slice(&base_side.to_le_bytes());

    let accounts = vec![
        AccountMeta::new_readonly(spl_token::id(), false),  // 0  token_program
        AccountMeta::new(*amm_info, false),                  // 1  amm_info
        AccountMeta::new_readonly(*amm_authority, false),    // 2  amm_authority
        AccountMeta::new(*target_orders, false),             // 3  target_orders
        AccountMeta::new(*lp_mint, false),                   // 4  lp_mint
        AccountMeta::new(*coin_vault, false),                // 5  coin_vault
        AccountMeta::new(*pc_vault, false),                  // 6  pc_vault
        AccountMeta::new(*user_coin, false),                 // 7  user_coin
        AccountMeta::new(*user_pc, false),                   // 8  user_pc
        AccountMeta::new(*user_lp, false),                   // 9  user_lp
        AccountMeta::new_readonly(*user_owner, true),        // 10 user_owner (signer)
    ];

    Instruction {
        program_id: program_id(),
        accounts,
        data,
    }
}

pub fn build_withdraw_ix(
    amount: u64,
    amm_info: &Pubkey,
    amm_authority: &Pubkey,
    target_orders: &Pubkey,
    lp_mint: &Pubkey,
    coin_vault: &Pubkey,
    pc_vault: &Pubkey,
    user_lp: &Pubkey,
    user_coin: &Pubkey,
    user_pc: &Pubkey,
    user_owner: &Pubkey,
) -> Instruction {
    // Data: [4][amount:u64le]
    let mut data = Vec::with_capacity(9);
    data.push(4u8);
    data.extend_from_slice(&amount.to_le_bytes());

    let accounts = vec![
        AccountMeta::new_readonly(spl_token::id(), false),  // 0  token_program
        AccountMeta::new(*amm_info, false),                  // 1  amm_info
        AccountMeta::new_readonly(*amm_authority, false),    // 2  amm_authority
        AccountMeta::new(*target_orders, false),             // 3  target_orders
        AccountMeta::new(*lp_mint, false),                   // 4  lp_mint
        AccountMeta::new(*coin_vault, false),                // 5  coin_vault
        AccountMeta::new(*pc_vault, false),                  // 6  pc_vault
        AccountMeta::new(*user_lp, false),                   // 7  user_lp  (NOTE: LP first, then coin/pc)
        AccountMeta::new(*user_coin, false),                 // 8  user_coin
        AccountMeta::new(*user_pc, false),                   // 9  user_pc
        AccountMeta::new_readonly(*user_owner, true),        // 10 user_owner (signer)
    ];

    Instruction {
        program_id: program_id(),
        accounts,
        data,
    }
}

pub fn build_swap_base_in_v2_ix(
    amount_in: u64,
    min_out: u64,
    amm_info: &Pubkey,
    amm_authority: &Pubkey,
    coin_vault: &Pubkey,
    pc_vault: &Pubkey,
    user_source: &Pubkey,
    user_dest: &Pubkey,
    user_owner: &Pubkey,
) -> Instruction {
    // Data: [16][amount_in:u64le][min_out:u64le]
    let mut data = Vec::with_capacity(17);
    data.push(16u8);
    data.extend_from_slice(&amount_in.to_le_bytes());
    data.extend_from_slice(&min_out.to_le_bytes());

    let accounts = vec![
        AccountMeta::new_readonly(spl_token::id(), false),  // 0  token_program
        AccountMeta::new(*amm_info, false),                  // 1  amm_info
        AccountMeta::new_readonly(*amm_authority, false),    // 2  amm_authority
        AccountMeta::new(*coin_vault, false),                // 3  coin_vault
        AccountMeta::new(*pc_vault, false),                  // 4  pc_vault
        AccountMeta::new(*user_source, false),               // 5  user_source
        AccountMeta::new(*user_dest, false),                 // 6  user_dest
        AccountMeta::new_readonly(*user_owner, true),        // 7  user_owner (signer)
    ];

    Instruction {
        program_id: program_id(),
        accounts,
        data,
    }
}

pub fn build_swap_base_out_v2_ix(
    max_in: u64,
    amount_out: u64,
    amm_info: &Pubkey,
    amm_authority: &Pubkey,
    coin_vault: &Pubkey,
    pc_vault: &Pubkey,
    user_source: &Pubkey,
    user_dest: &Pubkey,
    user_owner: &Pubkey,
) -> Instruction {
    // Data: [17][max_in:u64le][amount_out:u64le]
    let mut data = Vec::with_capacity(17);
    data.push(17u8);
    data.extend_from_slice(&max_in.to_le_bytes());
    data.extend_from_slice(&amount_out.to_le_bytes());

    let accounts = vec![
        AccountMeta::new_readonly(spl_token::id(), false),  // 0  token_program
        AccountMeta::new(*amm_info, false),                  // 1  amm_info
        AccountMeta::new_readonly(*amm_authority, false),    // 2  amm_authority
        AccountMeta::new(*coin_vault, false),                // 3  coin_vault
        AccountMeta::new(*pc_vault, false),                  // 4  pc_vault
        AccountMeta::new(*user_source, false),               // 5  user_source
        AccountMeta::new(*user_dest, false),                 // 6  user_dest
        AccountMeta::new_readonly(*user_owner, true),        // 7  user_owner (signer)
    ];

    Instruction {
        program_id: program_id(),
        accounts,
        data,
    }
}

// ---------------------------------------------------------------------------
// High-level pool creation helper
// ---------------------------------------------------------------------------

pub struct PoolAccounts {
    pub coin_mint: Pubkey,
    pub pc_mint: Pubkey,
    pub user_coin: Pubkey,
    pub user_pc: Pubkey,
    pub user_lp: Pubkey,
    pub pdas: PoolPdas,
    pub market_id: Pubkey,
}

/// Creates a fully initialized pool and returns all relevant account pubkeys.
/// Mints `user_coin_amount` COIN and `user_pc_amount` PC to user before pool init.
/// Deposits `init_coin_amount` COIN and `init_pc_amount` PC into the pool.
pub async fn create_pool(
    banks_client: &mut BanksClient,
    payer: &Keypair,
    recent_blockhash: &Hash,
    coin_decimals: u8,
    pc_decimals: u8,
    user_coin_amount: u64,
    user_pc_amount: u64,
    init_coin_amount: u64,
    init_pc_amount: u64,
) -> PoolAccounts {
    // Create mints
    let coin_mint = create_spl_mint(banks_client, payer, recent_blockhash, coin_decimals).await;
    let pc_mint = create_spl_mint(banks_client, payer, recent_blockhash, pc_decimals).await;

    // Create user token accounts
    let user_coin = create_token_account(banks_client, payer, recent_blockhash, &coin_mint, &payer.pubkey()).await;
    let user_pc = create_token_account(banks_client, payer, recent_blockhash, &pc_mint, &payer.pubkey()).await;

    // Mint tokens to user
    mint_tokens(banks_client, payer, recent_blockhash, &coin_mint, &user_coin, user_coin_amount).await;
    mint_tokens(banks_client, payer, recent_blockhash, &pc_mint, &user_pc, user_pc_amount).await;

    // Generate a random market_id
    let market_id_kp = Keypair::new();
    let market_id = market_id_kp.pubkey();

    // Derive all PDAs
    let pdas = derive_pool_pdas(&market_id);

    // Compute user LP ATA
    let user_lp = spl_associated_token_account::get_associated_token_address(
        &payer.pubkey(),
        &pdas.lp_mint,
    );

    // Build and send Initialize2
    let ix = build_initialize2_ix(
        pdas.nonce,
        0, // open_time = 0, so pool transitions to SwapOnly immediately
        init_pc_amount,
        init_coin_amount,
        &pdas.amm_info,
        &pdas.amm_authority,
        &pdas.lp_mint,
        &coin_mint,
        &pc_mint,
        &pdas.coin_vault,
        &pdas.pc_vault,
        &pdas.target_orders,
        &pdas.amm_config,
        &market_id,
        &payer.pubkey(),
        &user_coin,
        &user_pc,
        &user_lp,
    );

    // Need a fresh blockhash for each transaction
    let bh = banks_client.get_latest_blockhash().await.unwrap();
    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&payer.pubkey()),
        &[payer],
        bh,
    );
    banks_client.process_transaction(tx).await.unwrap();

    PoolAccounts {
        coin_mint,
        pc_mint,
        user_coin,
        user_pc,
        user_lp,
        pdas,
        market_id,
    }
}
