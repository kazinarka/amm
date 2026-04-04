mod helpers;

use helpers::*;
use solana_program::program_pack::Pack;
use solana_program_test::BanksClient;
use solana_sdk::{
    signature::{Keypair, Signer},
    transaction::Transaction,
};

// ---------------------------------------------------------------------------
// Test 1: Initialize2 — create a pool and verify state
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_initialize2_create_pool() {
    let (mut banks_client, payer, recent_blockhash) = setup_test_env().await;

    let coin_decimals = 6u8;
    let pc_decimals = 6u8;
    let init_amount: u64 = 100_000_000_000; // 100_000e6

    let pool = create_pool(
        &mut banks_client,
        &payer,
        &recent_blockhash,
        coin_decimals,
        pc_decimals,
        1_000_000_000_000, // 1_000_000e6 total coin minted to user
        1_000_000_000_000, // 1_000_000e6 total pc minted to user
        init_amount,
        init_amount,
    )
    .await;

    // Verify: AmmInfo account exists, is 752 bytes, owned by program
    let amm_account = banks_client
        .get_account(pool.pdas.amm_info)
        .await
        .unwrap()
        .expect("AmmInfo account should exist");
    assert_eq!(amm_account.data.len(), AMM_INFO_SIZE);
    assert_eq!(amm_account.owner, program_id());

    // Verify: coin_vault has init_amount tokens
    let coin_vault_balance = get_token_balance(&mut banks_client, &pool.pdas.coin_vault).await;
    assert_eq!(coin_vault_balance, init_amount);

    // Verify: pc_vault has init_amount tokens
    let pc_vault_balance = get_token_balance(&mut banks_client, &pool.pdas.pc_vault).await;
    assert_eq!(pc_vault_balance, init_amount);

    // Verify: user received LP tokens (> 0)
    let user_lp_balance = get_token_balance(&mut banks_client, &pool.user_lp).await;
    assert!(user_lp_balance > 0, "User should have received LP tokens");

    // Verify: user coin balance decreased
    let user_coin_balance = get_token_balance(&mut banks_client, &pool.user_coin).await;
    assert_eq!(user_coin_balance, 1_000_000_000_000 - init_amount);

    // Verify: user pc balance decreased
    let user_pc_balance = get_token_balance(&mut banks_client, &pool.user_pc).await;
    assert_eq!(user_pc_balance, 1_000_000_000_000 - init_amount);
}

// ---------------------------------------------------------------------------
// Test 2: Deposit — add liquidity to an existing pool
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_deposit() {
    let (mut banks_client, payer, recent_blockhash) = setup_test_env().await;

    let pool = create_pool(
        &mut banks_client,
        &payer,
        &recent_blockhash,
        6,
        6,
        1_000_000_000_000,
        1_000_000_000_000,
        100_000_000_000,
        100_000_000_000,
    )
    .await;

    // Record balances before deposit
    let coin_vault_before = get_token_balance(&mut banks_client, &pool.pdas.coin_vault).await;
    let pc_vault_before = get_token_balance(&mut banks_client, &pool.pdas.pc_vault).await;
    let user_lp_before = get_token_balance(&mut banks_client, &pool.user_lp).await;

    // Deposit: base_side=0, max_coin=10_000e6, max_pc=u64::MAX
    let deposit_ix = build_deposit_ix(
        10_000_000_000, // max_coin = 10_000e6
        u64::MAX,       // max_pc = unlimited
        0,              // base_side = 0 (coin is fixed side)
        &pool.pdas.amm_info,
        &pool.pdas.amm_authority,
        &pool.pdas.target_orders,
        &pool.pdas.lp_mint,
        &pool.pdas.coin_vault,
        &pool.pdas.pc_vault,
        &pool.user_coin,
        &pool.user_pc,
        &pool.user_lp,
        &payer.pubkey(),
    );

    let bh = banks_client.get_latest_blockhash().await.unwrap();
    let tx = Transaction::new_signed_with_payer(
        &[deposit_ix],
        Some(&payer.pubkey()),
        &[&payer],
        bh,
    );
    banks_client.process_transaction(tx).await.unwrap();

    // Verify: vault balances increased
    let coin_vault_after = get_token_balance(&mut banks_client, &pool.pdas.coin_vault).await;
    let pc_vault_after = get_token_balance(&mut banks_client, &pool.pdas.pc_vault).await;
    assert!(
        coin_vault_after > coin_vault_before,
        "Coin vault should have increased"
    );
    assert!(
        pc_vault_after > pc_vault_before,
        "PC vault should have increased"
    );

    // Verify: user LP balance increased
    let user_lp_after = get_token_balance(&mut banks_client, &pool.user_lp).await;
    assert!(
        user_lp_after > user_lp_before,
        "User LP balance should have increased"
    );
}

// ---------------------------------------------------------------------------
// Test 3: Withdraw — remove liquidity from pool
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_withdraw() {
    let (mut banks_client, payer, recent_blockhash) = setup_test_env().await;

    let pool = create_pool(
        &mut banks_client,
        &payer,
        &recent_blockhash,
        6,
        6,
        1_000_000_000_000,
        1_000_000_000_000,
        100_000_000_000,
        100_000_000_000,
    )
    .await;

    // Record balances before withdraw
    let user_coin_before = get_token_balance(&mut banks_client, &pool.user_coin).await;
    let user_pc_before = get_token_balance(&mut banks_client, &pool.user_pc).await;
    let user_lp_balance = get_token_balance(&mut banks_client, &pool.user_lp).await;
    let coin_vault_before = get_token_balance(&mut banks_client, &pool.pdas.coin_vault).await;
    let pc_vault_before = get_token_balance(&mut banks_client, &pool.pdas.pc_vault).await;

    // Withdraw 50% of user's LP tokens
    let withdraw_amount = user_lp_balance / 2;

    let withdraw_ix = build_withdraw_ix(
        withdraw_amount,
        &pool.pdas.amm_info,
        &pool.pdas.amm_authority,
        &pool.pdas.target_orders,
        &pool.pdas.lp_mint,
        &pool.pdas.coin_vault,
        &pool.pdas.pc_vault,
        &pool.user_lp,
        &pool.user_coin,
        &pool.user_pc,
        &payer.pubkey(),
    );

    let bh = banks_client.get_latest_blockhash().await.unwrap();
    let tx = Transaction::new_signed_with_payer(
        &[withdraw_ix],
        Some(&payer.pubkey()),
        &[&payer],
        bh,
    );
    banks_client.process_transaction(tx).await.unwrap();

    // Verify: user received proportional COIN and PC
    let user_coin_after = get_token_balance(&mut banks_client, &pool.user_coin).await;
    let user_pc_after = get_token_balance(&mut banks_client, &pool.user_pc).await;
    assert!(
        user_coin_after > user_coin_before,
        "User should have received COIN tokens"
    );
    assert!(
        user_pc_after > user_pc_before,
        "User should have received PC tokens"
    );

    // Verify: vault balances decreased
    let coin_vault_after = get_token_balance(&mut banks_client, &pool.pdas.coin_vault).await;
    let pc_vault_after = get_token_balance(&mut banks_client, &pool.pdas.pc_vault).await;
    assert!(
        coin_vault_after < coin_vault_before,
        "Coin vault should have decreased"
    );
    assert!(
        pc_vault_after < pc_vault_before,
        "PC vault should have decreased"
    );
}

// ---------------------------------------------------------------------------
// Test 4: SwapBaseInV2 — swap COIN → PC
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_swap_base_in_v2_coin_to_pc() {
    let (mut banks_client, payer, recent_blockhash) = setup_test_env().await;

    let pool = create_pool(
        &mut banks_client,
        &payer,
        &recent_blockhash,
        6,
        6,
        1_000_000_000_000,
        1_000_000_000_000,
        100_000_000_000,
        100_000_000_000,
    )
    .await;

    let swap_amount: u64 = 1_000_000_000; // 1_000e6

    let user_coin_before = get_token_balance(&mut banks_client, &pool.user_coin).await;
    let user_pc_before = get_token_balance(&mut banks_client, &pool.user_pc).await;
    let coin_vault_before = get_token_balance(&mut banks_client, &pool.pdas.coin_vault).await;
    let pc_vault_before = get_token_balance(&mut banks_client, &pool.pdas.pc_vault).await;

    // Swap COIN → PC: user_source=user_coin, user_dest=user_pc
    let swap_ix = build_swap_base_in_v2_ix(
        swap_amount,
        0, // min_out = 0 (accept any)
        &pool.pdas.amm_info,
        &pool.pdas.amm_authority,
        &pool.pdas.coin_vault,
        &pool.pdas.pc_vault,
        &pool.user_coin,
        &pool.user_pc,
        &payer.pubkey(),
    );

    let bh = banks_client.get_latest_blockhash().await.unwrap();
    let tx = Transaction::new_signed_with_payer(
        &[swap_ix],
        Some(&payer.pubkey()),
        &[&payer],
        bh,
    );
    banks_client.process_transaction(tx).await.unwrap();

    // Verify: user COIN decreased by swap_amount
    let user_coin_after = get_token_balance(&mut banks_client, &pool.user_coin).await;
    assert_eq!(user_coin_after, user_coin_before - swap_amount);

    // Verify: user PC increased (> 0, follows constant product)
    let user_pc_after = get_token_balance(&mut banks_client, &pool.user_pc).await;
    assert!(
        user_pc_after > user_pc_before,
        "User PC balance should have increased"
    );

    // Verify: coin_vault increased, pc_vault decreased
    let coin_vault_after = get_token_balance(&mut banks_client, &pool.pdas.coin_vault).await;
    let pc_vault_after = get_token_balance(&mut banks_client, &pool.pdas.pc_vault).await;
    assert_eq!(coin_vault_after, coin_vault_before + swap_amount);
    assert!(pc_vault_after < pc_vault_before, "PC vault should decrease");
}

// ---------------------------------------------------------------------------
// Test 5: SwapBaseInV2 — swap PC → COIN (reverse direction)
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_swap_base_in_v2_pc_to_coin() {
    let (mut banks_client, payer, recent_blockhash) = setup_test_env().await;

    let pool = create_pool(
        &mut banks_client,
        &payer,
        &recent_blockhash,
        6,
        6,
        1_000_000_000_000,
        1_000_000_000_000,
        100_000_000_000,
        100_000_000_000,
    )
    .await;

    let swap_amount: u64 = 1_000_000_000; // 1_000e6

    let user_pc_before = get_token_balance(&mut banks_client, &pool.user_pc).await;
    let user_coin_before = get_token_balance(&mut banks_client, &pool.user_coin).await;

    // Swap PC → COIN: user_source=user_pc, user_dest=user_coin
    let swap_ix = build_swap_base_in_v2_ix(
        swap_amount,
        0,
        &pool.pdas.amm_info,
        &pool.pdas.amm_authority,
        &pool.pdas.coin_vault,
        &pool.pdas.pc_vault,
        &pool.user_pc,    // source is PC
        &pool.user_coin,  // dest is COIN
        &payer.pubkey(),
    );

    let bh = banks_client.get_latest_blockhash().await.unwrap();
    let tx = Transaction::new_signed_with_payer(
        &[swap_ix],
        Some(&payer.pubkey()),
        &[&payer],
        bh,
    );
    banks_client.process_transaction(tx).await.unwrap();

    // Verify: user PC decreased
    let user_pc_after = get_token_balance(&mut banks_client, &pool.user_pc).await;
    assert_eq!(user_pc_after, user_pc_before - swap_amount);

    // Verify: user COIN increased
    let user_coin_after = get_token_balance(&mut banks_client, &pool.user_coin).await;
    assert!(
        user_coin_after > user_coin_before,
        "User COIN balance should have increased"
    );
}

// ---------------------------------------------------------------------------
// Test 6: SwapBaseOutV2 — swap for exact output amount
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_swap_base_out_v2() {
    let (mut banks_client, payer, recent_blockhash) = setup_test_env().await;

    let pool = create_pool(
        &mut banks_client,
        &payer,
        &recent_blockhash,
        6,
        6,
        1_000_000_000_000,
        1_000_000_000_000,
        100_000_000_000,
        100_000_000_000,
    )
    .await;

    let desired_pc_out: u64 = 1_000_000_000; // 1_000e6

    let user_coin_before = get_token_balance(&mut banks_client, &pool.user_coin).await;
    let user_pc_before = get_token_balance(&mut banks_client, &pool.user_pc).await;

    // SwapBaseOutV2: spend COIN to get exactly desired_pc_out PC
    // user_source=user_coin, user_dest=user_pc
    let swap_ix = build_swap_base_out_v2_ix(
        u64::MAX, // max_in = unlimited
        desired_pc_out,
        &pool.pdas.amm_info,
        &pool.pdas.amm_authority,
        &pool.pdas.coin_vault,
        &pool.pdas.pc_vault,
        &pool.user_coin,
        &pool.user_pc,
        &payer.pubkey(),
    );

    let bh = banks_client.get_latest_blockhash().await.unwrap();
    let tx = Transaction::new_signed_with_payer(
        &[swap_ix],
        Some(&payer.pubkey()),
        &[&payer],
        bh,
    );
    banks_client.process_transaction(tx).await.unwrap();

    // Verify: user PC increased by exactly desired_pc_out
    let user_pc_after = get_token_balance(&mut banks_client, &pool.user_pc).await;
    assert_eq!(user_pc_after, user_pc_before + desired_pc_out);

    // Verify: user COIN decreased (some amount spent)
    let user_coin_after = get_token_balance(&mut banks_client, &pool.user_coin).await;
    assert!(
        user_coin_after < user_coin_before,
        "User COIN should have decreased"
    );
}

// ---------------------------------------------------------------------------
// Test 7: Swap roundtrip — COIN→PC then PC→COIN, user ends with less due to fees
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_swap_roundtrip() {
    let (mut banks_client, payer, recent_blockhash) = setup_test_env().await;

    let pool = create_pool(
        &mut banks_client,
        &payer,
        &recent_blockhash,
        6,
        6,
        1_000_000_000_000,
        1_000_000_000_000,
        100_000_000_000,
        100_000_000_000,
    )
    .await;

    let swap_amount: u64 = 1_000_000_000; // 1_000e6

    let user_coin_start = get_token_balance(&mut banks_client, &pool.user_coin).await;

    // Step 1: Swap COIN → PC
    let swap_ix1 = build_swap_base_in_v2_ix(
        swap_amount,
        0,
        &pool.pdas.amm_info,
        &pool.pdas.amm_authority,
        &pool.pdas.coin_vault,
        &pool.pdas.pc_vault,
        &pool.user_coin,
        &pool.user_pc,
        &payer.pubkey(),
    );
    let bh = banks_client.get_latest_blockhash().await.unwrap();
    let tx1 = Transaction::new_signed_with_payer(
        &[swap_ix1],
        Some(&payer.pubkey()),
        &[&payer],
        bh,
    );
    banks_client.process_transaction(tx1).await.unwrap();

    // Record how much PC we got
    let user_pc_mid = get_token_balance(&mut banks_client, &pool.user_pc).await;
    // Calculate the PC gained from swap
    let pc_gained = user_pc_mid - (1_000_000_000_000 - 100_000_000_000);

    // Step 2: Swap PC → COIN (swap back the PC we received)
    let swap_ix2 = build_swap_base_in_v2_ix(
        pc_gained,
        0,
        &pool.pdas.amm_info,
        &pool.pdas.amm_authority,
        &pool.pdas.coin_vault,
        &pool.pdas.pc_vault,
        &pool.user_pc,
        &pool.user_coin,
        &payer.pubkey(),
    );
    let bh2 = banks_client.get_latest_blockhash().await.unwrap();
    let tx2 = Transaction::new_signed_with_payer(
        &[swap_ix2],
        Some(&payer.pubkey()),
        &[&payer],
        bh2,
    );
    banks_client.process_transaction(tx2).await.unwrap();

    // Verify: both swaps succeeded, user ends with slightly less COIN due to fees
    let user_coin_end = get_token_balance(&mut banks_client, &pool.user_coin).await;
    assert!(
        user_coin_end < user_coin_start,
        "User should end with less COIN due to swap fees. start={}, end={}",
        user_coin_start,
        user_coin_end
    );
}

// ---------------------------------------------------------------------------
// Test 8: Initialize2 duplicate pool fails
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_initialize2_duplicate_pool_fails() {
    let (mut banks_client, payer, recent_blockhash) = setup_test_env().await;

    // Create mints and mint tokens
    let coin_mint = create_spl_mint(&mut banks_client, &payer, &recent_blockhash, 6).await;
    let pc_mint = create_spl_mint(&mut banks_client, &payer, &recent_blockhash, 6).await;
    let user_coin = create_token_account(&mut banks_client, &payer, &recent_blockhash, &coin_mint, &payer.pubkey()).await;
    let user_pc = create_token_account(&mut banks_client, &payer, &recent_blockhash, &pc_mint, &payer.pubkey()).await;
    mint_tokens(&mut banks_client, &payer, &recent_blockhash, &coin_mint, &user_coin, 1_000_000_000_000).await;
    mint_tokens(&mut banks_client, &payer, &recent_blockhash, &pc_mint, &user_pc, 1_000_000_000_000).await;

    let market_id_kp = Keypair::new();
    let market_id = market_id_kp.pubkey();
    let pdas = derive_pool_pdas(&market_id);
    let user_lp = spl_associated_token_account::get_associated_token_address(&payer.pubkey(), &pdas.lp_mint);

    // First Initialize2 — should succeed
    let ix = build_initialize2_ix(
        pdas.nonce,
        0,
        100_000_000_000,
        100_000_000_000,
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
    let bh = banks_client.get_latest_blockhash().await.unwrap();
    let tx = Transaction::new_signed_with_payer(&[ix], Some(&payer.pubkey()), &[&payer], bh);
    banks_client.process_transaction(tx).await.unwrap();

    // Second Initialize2 with same market_id — should fail (PDA already initialized)
    // We need new user token accounts since the old ones are already drained
    let user_coin2 = create_token_account(&mut banks_client, &payer, &recent_blockhash, &coin_mint, &payer.pubkey()).await;
    let user_pc2 = create_token_account(&mut banks_client, &payer, &recent_blockhash, &pc_mint, &payer.pubkey()).await;
    let bh2 = banks_client.get_latest_blockhash().await.unwrap();
    mint_tokens(&mut banks_client, &payer, &bh2, &coin_mint, &user_coin2, 200_000_000_000).await;
    let bh3 = banks_client.get_latest_blockhash().await.unwrap();
    mint_tokens(&mut banks_client, &payer, &bh3, &pc_mint, &user_pc2, 200_000_000_000).await;

    let ix2 = build_initialize2_ix(
        pdas.nonce,
        0,
        100_000_000_000,
        100_000_000_000,
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
        &user_coin2,
        &user_pc2,
        &user_lp,
    );
    let bh4 = banks_client.get_latest_blockhash().await.unwrap();
    let tx2 = Transaction::new_signed_with_payer(&[ix2], Some(&payer.pubkey()), &[&payer], bh4);
    let result = banks_client.process_transaction(tx2).await;
    assert!(
        result.is_err(),
        "Second Initialize2 with same market_id should fail"
    );
}

// ---------------------------------------------------------------------------
// Test 9: Withdraw more LP than balance fails
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_withdraw_more_than_balance_fails() {
    let (mut banks_client, payer, recent_blockhash) = setup_test_env().await;

    let pool = create_pool(
        &mut banks_client,
        &payer,
        &recent_blockhash,
        6,
        6,
        1_000_000_000_000,
        1_000_000_000_000,
        100_000_000_000,
        100_000_000_000,
    )
    .await;

    let user_lp_balance = get_token_balance(&mut banks_client, &pool.user_lp).await;

    // Try to withdraw more LP than user has
    let withdraw_ix = build_withdraw_ix(
        user_lp_balance + 1,
        &pool.pdas.amm_info,
        &pool.pdas.amm_authority,
        &pool.pdas.target_orders,
        &pool.pdas.lp_mint,
        &pool.pdas.coin_vault,
        &pool.pdas.pc_vault,
        &pool.user_lp,
        &pool.user_coin,
        &pool.user_pc,
        &payer.pubkey(),
    );

    let bh = banks_client.get_latest_blockhash().await.unwrap();
    let tx = Transaction::new_signed_with_payer(
        &[withdraw_ix],
        Some(&payer.pubkey()),
        &[&payer],
        bh,
    );
    let result = banks_client.process_transaction(tx).await;
    assert!(
        result.is_err(),
        "Withdrawing more LP than balance should fail"
    );
}

// ---------------------------------------------------------------------------
// Test 10: Deposit zero fails
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_deposit_zero_fails() {
    let (mut banks_client, payer, recent_blockhash) = setup_test_env().await;

    let pool = create_pool(
        &mut banks_client,
        &payer,
        &recent_blockhash,
        6,
        6,
        1_000_000_000_000,
        1_000_000_000_000,
        100_000_000_000,
        100_000_000_000,
    )
    .await;

    // Try to deposit 0 tokens
    let deposit_ix = build_deposit_ix(
        0, // max_coin = 0
        0, // max_pc = 0
        0,
        &pool.pdas.amm_info,
        &pool.pdas.amm_authority,
        &pool.pdas.target_orders,
        &pool.pdas.lp_mint,
        &pool.pdas.coin_vault,
        &pool.pdas.pc_vault,
        &pool.user_coin,
        &pool.user_pc,
        &pool.user_lp,
        &payer.pubkey(),
    );

    let bh = banks_client.get_latest_blockhash().await.unwrap();
    let tx = Transaction::new_signed_with_payer(
        &[deposit_ix],
        Some(&payer.pubkey()),
        &[&payer],
        bh,
    );
    let result = banks_client.process_transaction(tx).await;
    assert!(
        result.is_err(),
        "Depositing 0 tokens should fail with InvalidInput"
    );
}
