// すべてを DOMContentLoaded 後に実行
document.addEventListener("DOMContentLoaded", () => {
    // ===== 共通ユーティリティ =====
    const getCsrf = () =>
        document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute("content") || "";

    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

    // ===== 1) Ajaxテストボタン（存在するページのみ動作）=====
    (function ajaxTestBlock() {
        const button = $(".iza");
        const input = document.querySelector('input[name="id"]');
        const ul = document.querySelector("ul");
        if (!button || !input || !ul) return;

        button.addEventListener("click", () => {
            const id = input.value;
            fetch("/photoAjax", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-TOKEN": getCsrf(),
                },
                body: JSON.stringify({ id }),
            })
                .then((r) => r.json())
                .then((res) => {
                    if (res.name) {
                        const li = document.createElement("li");
                        li.textContent = res.name;
                        ul.appendChild(li);
                    } else if (res.error) {
                        alert(res.error);
                    }
                })
                .catch((err) => console.error("通信エラー:", err));
        });
    })();

    // ===== 2) 固定ボックスのフッター手前停止（要素が揃っているページだけ） =====
    (function stickyBoxBlock() {
        const exFormBox = $("#ex_form_box");
        const footer = $("#footer");
        const exAllBack = $(".ex_all_back");
        if (!exFormBox || !footer || !exAllBack) return;

        const checkPosition = () => {
            const footerTop =
                footer.getBoundingClientRect().top + window.scrollY;
            const exAllBackTop =
                exAllBack.getBoundingClientRect().top + window.scrollY;
            const boxHeight = exFormBox.offsetHeight;

            if (window.scrollY + boxHeight >= footerTop) {
                exFormBox.classList.add("unfixed");
                const relativeTop = footerTop - exAllBackTop - boxHeight;
                exFormBox.style.top = relativeTop + "px";
            } else {
                exFormBox.classList.remove("unfixed");
                const fixedTopPx = window.innerWidth * 0.115;
                exFormBox.style.top = fixedTopPx + "px";
            }
        };

        window.addEventListener("scroll", checkPosition);
        window.addEventListener("resize", checkPosition);
        checkPosition();
    })();

    // ===== 3) 画像プレビュー（exhibition / ユーザーアイコン / 新規投稿） =====
    // 共通：<input id="X"> に対し、プレビュー挿入先は <div id="X_preview">
    function attachInputPreview(input, imgClass) {
        input.addEventListener("change", (e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (ev) => {
                const previewId = input.id + "_preview";
                const container = document.getElementById(previewId);
                if (!container) return;

                container.innerHTML = "";
                const img = document.createElement("img");
                img.src = ev.target.result;
                if (imgClass) img.classList.add(imgClass);
                container.appendChild(img);
            };
        });
    }

    // 3-1) exhibition 用：name="photo[]" の file input すべて
    $$('input[type="file"][name="photo[]"]').forEach((input) => {
        attachInputPreview(input, "ex_photo_preview");
    });

    // 3-2) ユーザーアイコン：label.icon_inputLabel クリック → 対応する input にバインド
    $$(".icon_inputLabel").forEach((label) => {
        label.addEventListener("click", (e) => {
            const forId = label.getAttribute("for") || e.currentTarget.id; // for 属性優先
            if (!forId) return;
            const input = document.getElementById(forId);
            if (!input) return;
            // 二重で addEventListener しないよう、一度だけ付与
            if (!input.dataset._previewBound) {
                attachInputPreview(input, "user_icon");
                input.dataset._previewBound = "1";
            }
        });
    });

    // 3-3) 新規投稿：label.post_inputLabel → 対応する input にバインド
    $$(".post_inputLabel").forEach((label) => {
        label.addEventListener("click", (e) => {
            const forId = label.getAttribute("for") || e.currentTarget.id;
            if (!forId) return;
            const input = document.getElementById(forId);
            if (!input) return;
            if (!input.dataset._previewBound) {
                attachInputPreview(input, "post_base");
                input.dataset._previewBound = "1";
            }
        });
    });

    // ===== 4) ギャラリーモーダル =====
    (function galleryModalBlock() {
        const modal = $(".myModal");
        const modalImg = $("#js-modal-img");
        const modalIcon = $("#js_user_icon");
        if (!modal || !modalImg || !modalIcon) return;

        // 画像クリック（イベントデリゲーション）
        document.addEventListener("click", async (e) => {
            const img = e.target.closest(".photo");
            if (!img) return;

            const photoId = img.id;

            // 1) まずモーダルを開く（通信失敗でも表示）
            modal.classList.add("is-open"); // ← これで overlay が grid になり中央寄せ
            document.body.classList.add("no-scroll"); // ← 任意：背面スクロール止める
            modalImg.src = img.src;

            // 2) Ajaxでメタ情報を取得して埋める
            try {
                const res = await fetch("/photoAjax", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRF-TOKEN": getCsrf(),
                    },
                    body: JSON.stringify({ photoId }),
                });
                if (!res.ok) throw new Error("HTTP " + res.status);
                const data = await res.json();

                const userPage = $("#userPage");
                const userIconA = $("#userIcon");
                const title = $("#galleryTitle");
                const comment = $("#galleryComment");
                const dlPath = $("#download_path");
                const dlPhoto = $("#download_photo");
                const postDelete = $("#postDelete");
                const cartPhoto = $("#cart_photo");
                const cartName = $("#cart_name");
                const cartId = $("#cart_id");
                const emptyHeart = $("#empty-heart");

                if (userPage) {
                    userPage.href = `/user/page/${data.user_id}`;
                    userPage.textContent = data.user_name ?? "ユーザーページ";
                }
                if (userIconA) userIconA.href = `/user/page/${data.user_id}`;
                modalIcon.src = data.user_icon_path ?? "";

                if (title) title.textContent = data.title ?? "";
                if (comment) comment.textContent = data.comment ?? "";

                if (dlPath)
                    dlPath.value = `/storage/images/${data.photo_photo || ""}`;
                if (dlPhoto) dlPhoto.value = data.photo_photo ?? "";

                if (postDelete)
                    postDelete.href = `/post/delete/${data.photo_id}`;

                if (cartPhoto) cartPhoto.value = data.photo_photo ?? "";
                if (cartName) cartName.value = data.title ?? "";
                if (cartId) cartId.value = data.photo_id ?? "";

                if (emptyHeart && data.photo_id) {
                    emptyHeart.dataset.photoId = String(data.photo_id);
                }
            } catch (err) {
                console.error("photoAjax 取得に失敗:", err);
            }
        });

        // 背景クリックで閉じる
        modal.addEventListener("click", (e) => {
            if (e.target === modal) {
                modal.classList.remove("is-open");
                document.body.classList.remove("no-scroll");
            }
        });

        // ESCキーで閉じる（任意）
        document.addEventListener("keydown", (ev) => {
            if (ev.key === "Escape" && modal.classList.contains("is-open")) {
                modal.classList.remove("is-open");
                document.body.classList.remove("no-scroll");
            }
        });
    })();

    // ===== 5) お気に入りボタン（ハート） =====
    (function favoriteBlock() {
        const heart = $("#empty-heart");
        if (!heart) return;

        heart.addEventListener("click", async (e) => {
            const photoId = e.currentTarget.dataset.photoId;
            if (!photoId) {
                console.error("photoId が取得できませんでした。");
                return;
            }
            try {
                const res = await fetch("/favorite/store", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRF-TOKEN": getCsrf(),
                    },
                    body: JSON.stringify({ photo_id: photoId }),
                });
                if (!res.ok) throw new Error("HTTP " + res.status);
                console.log("お気に入り登録成功");
            } catch (err) {
                console.error("通信エラー:", err);
            }
        });
    })();

    // ===== 6) グループ用モーダル（存在するページのみ） =====
    (function groupModalBlock() {
        const groupPages = $$(".groupModal");
        if (groupPages.length === 0) return;

        const openBtns = $$(".group_join");

        openBtns.forEach((btn) => {
            btn.addEventListener("click", (e) => {
                groupPages.forEach((page) => (page.style.display = "block"));
            });
        });

        window.addEventListener("click", (e) => {
            groupPages.forEach((page) => {
                if (e.target === page) page.style.display = "none";
            });
        });
    })();

    // ===== 7) Sortable 並び替え（存在するページのみ）=====
    (function sortableBlock() {
        const blockList = $("#exhibition");
        if (!blockList || !window.Sortable) return;

        window.Sortable.create(blockList, {
            animation: 500,
            onEnd() {
                const newOrder = $$(".ex_block", blockList).map(
                    (r) => r.dataset.id
                );
                fetch("/exhibition", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRF-TOKEN": getCsrf(),
                    },
                    body: JSON.stringify({ newOrder }),
                }).catch((err) => console.error("並び順保存エラー:", err));
            },
        });
    })();

    // ===== デバッグ出力（必要なら残す）=====
    console.log(
        "myModal数=",
        $$(".myModal").length,
        "photo数=",
        $$(".photo").length,
        "modalImg?",
        !!$("#js-modal-img"),
        "modalIcon?",
        !!$("#js_user_icon")
    );

    
});
