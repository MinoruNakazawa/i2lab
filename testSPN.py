import numpy as np

def substitution(input_block, s_box):
    """
    Substitution step using an S-box
    """
    return [s_box[byte] for byte in input_block]

def permutation(input_block, p_box):
    """
    Permutation step using a P-box
    """
    output_block = [0] * len(input_block)
    for i, byte in enumerate(input_block):
        output_block[p_box[i]] = byte
    return output_block

def spn_encrypt(plaintext, key, s_box, p_box, rounds):
    """
    Encrypt a block of plaintext using SPN with the provided key, S-box, P-box, and number of rounds
    """
    cipher_block = plaintext
    round_keys = np.array_split(key, rounds)
    for round_key in round_keys[:-1]:
        cipher_block = substitution(cipher_block, s_box)
        cipher_block = permutation(cipher_block, p_box)
        cipher_block = np.bitwise_xor(cipher_block, round_key)
    cipher_block = substitution(cipher_block, s_box)
    cipher_block = np.bitwise_xor(cipher_block, round_keys[-1])
    return cipher_block

# Example usage:
plaintext_block = np.array([0, 1, 2, 3])
key = np.array([0, 1, 2, 3, 4, 5, 6, 7])
s_box = [3, 1, 0, 2]
p_box = [3, 2, 1, 0]
rounds = 2

cipher_block = spn_encrypt(plaintext_block, key, s_box, p_box, rounds)
print(f'Encrypted block: {cipher_block}')
